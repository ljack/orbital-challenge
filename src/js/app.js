require('../css/main.css');
import {
    THREE
}
from 'three';
import {
    Graph
}
from './Graph.js';
import _OrbitControls from 'three-orbit-controls';
let OrbitControls = _OrbitControls(THREE);
import {
    SatelliteLocationData
}
from './satelliteData.js';
import {
    addSatellites
}
from './satelliteMarkers.js';
import {
    addEarth
}
from './earth.js';
import {
    addRouteMarkers
}
from './routeMarkers.js';
import {
    addLine
}
from './util.js';

import {
    SpriteText2D, textAlign
}
from 'three-text2d';

// module globals
let onRenderFcts = [];
var scene;

// startup begins
var satData = new SatelliteLocationData();

let xhr = new XMLHttpRequest();
xhr.open('GET', 'https://space-fast-track.herokuapp.com/generate', true); // load data
xhr.onreadystatechange = e => {
    if (xhr.readyState === 4) {
        if (xhr.status === 200) {
            console.log(" satellite data received " + xhr.responseText);
            let rows = xhr.responseText.split("\n");
            satData.update(rows);
            createMap(satData);
        }
    }
};
xhr.send(null);
// startup ends

/**
 * Check if earth is blocking line-of-sight between fromPosition to targetPosition
 */
function checkIfTargetVisible(fromPosition, targetPosition, earthMesh) {
    // console.log("checkIfTargetVisible, fromPosition" + fromPosition + "targetPosition" + targetPosition + "earthMesh=" + earthMesh);

    let raycaster = new THREE.Raycaster();
    let direction = new THREE.Vector3();

    direction.subVectors(targetPosition, fromPosition);

    raycaster.set(fromPosition, direction.normalize());
    let intersects = raycaster.intersectObject(earthMesh);

    // console.log(`from: ${p(fromPosition)} to:${p(targetPosition)} intersects=${intersects.length}`);
    return intersects == 0;

}


// Particle animation from http://stackoverflow.com/questions/25898635/three-js-how-to-animate-particles-along-a-line
function createLinePoints(startPoint, endPoint, numPoints) {
    console.log("createLinePoints, start=" + startPoint + " endPoint=" + endPoint);
    var returnPoints = [];
    for (let i = 0; i <= numPoints; i++) {
        var thisPoint = startPoint.clone().lerp(endPoint, i / numPoints);
        returnPoints.push(thisPoint);
    }
    return returnPoints;
}

function constrain(v, min, max) {
    if (v < min)
        v = min;
    else
    if (v > max)
        v = max;
    return v;
}

function addParticles(animationPoints, onRenderFcts, scene) {

    let particles = Math.floor(animationPoints.length) + 1;;
    particles = constrain(particles, 1, 100);

    let particleGeometry = new THREE.BufferGeometry();
    particleGeometry.vertices = [];

    //add particles to scene
    console.log("particles=", particles);
    for (let i = 0; i < particles; i++) {
        let desiredIndex = i / particles * animationPoints.length;
        let rIndex = constrain(Math.floor(desiredIndex), 0, animationPoints.length - 1);

        let particle = animationPoints[rIndex].clone();
        particle.moveIndex = rIndex;
        particle.nextIndex = rIndex + 1;
        if (particle.nextIndex >= animationPoints.length)
            particle.nextIndex = 0;
        particle.lerpN = 0;
        particle.path = animationPoints;
        particle.size = 150;
        particleGeometry.vertices.push(particle);
    }


    let uniforms = {
        color: {
            type: "c",
            value: new THREE.Color(0xffffff)
        },
        texture: {
            type: "t",
            value: new THREE.TextureLoader().load("images/particleA.png")
        }
    };

    let shaderMaterial = new THREE.ShaderMaterial({
        uniforms: uniforms,
        vertexShader: document.getElementById('vertexshader').textContent,
        fragmentShader: document.getElementById('fragmentshader').textContent,
        blending: THREE.AdditiveBlending,
        depthTest: true,
        depthWrite: false,
        transparent: true
    });

    let positions = new Float32Array(particles * 3);
    let colors = new Float32Array(particles * 3);
    let sizes = new Float32Array(particles);
    let color = new THREE.Color();
    for (var i = 0, i3 = 0; i < particles; i++, i3 += 3) {

        let desiredIndex = i / particles * animationPoints.length;
        let rIndex = constrain(Math.floor(desiredIndex), 0, animationPoints.length - 1);
        let particle = animationPoints[rIndex].clone();

        positions[i3 + 0] = particle.x;
        positions[i3 + 1] = particle.y;
        positions[i3 + 2] = particle.z;

        color.setHSL(0.3, 0.9, 0.5);

        colors[i3 + 0] = color.r;
        colors[i3 + 1] = color.g;
        colors[i3 + 2] = color.b;

        sizes[i] = 20+Math.random();

    }

    particleGeometry.addAttribute('position', new THREE.BufferAttribute(positions, 3));
    particleGeometry.addAttribute('customColor', new THREE.BufferAttribute(colors, 3));
    particleGeometry.addAttribute('size', new THREE.BufferAttribute(sizes, 1));
    let particleSystem = new THREE.Points(particleGeometry, shaderMaterial);
    scene.add(particleSystem);

    onRenderFcts.push(function() {
        // var time = Date.now()
        for (let i = 0, i3 = 0; i < particleGeometry.vertices.length; i++, i3 += 3) {
            let particle = particleGeometry.vertices[i];
            let path = particle.path;
            particle.lerpN += 2;
            if (particle.lerpN > 1) {
                particle.lerpN = 0;
                particle.moveIndex = particle.nextIndex;
                particle.nextIndex++;
                if (particle.nextIndex >= path.length) {
                    particle.moveIndex = 0;
                    particle.nextIndex = 1;
                }
            }
            let currentPoint = path[particle.moveIndex];
            let nextPoint = path[particle.nextIndex];
            particle.copy(currentPoint);
            particle.lerp(nextPoint, particle.lerpN);
            //console.log( particleGeometry.attributes.position);
            particleGeometry.attributes.position.array[i3 + 0] = particle.x;
            particleGeometry.attributes.position.array[i3 + 1] = particle.y;
            particleGeometry.attributes.position.array[i3 + 2] = particle.z;

        }
        // particleGeometry.attributes.size.needsUpdate = true;
        particleGeometry.attributes.position.needsUpdate = true;
        particleGeometry.attributes.size.needsUpdate = true;
        particleGeometry.verticesNeedUpdate = true;

    });

    // onRenderFcts.push(function(delta) {

    //     particleSystem.rotation.z = 0.01 * delta;
    //     var sizes = geometry.attributes.size.array;
    //     for (var i = 0; i < particles; i++) {
    //         sizes[i] = 10 * (1 + Math.sin(0.1 * i + delta));
    //     }
    //     geometry.attributes.size.needsUpdate = true;

    // });
}

/**
 * Get list of visible satellites from currentPosition (Vector3)
 * Also draw lines between visible satellites
 */
function getVisibleSatellites(currentPosition, colorVisible = 0xfefefe, colorNotVisible = 0xff0000, satInfos, earthMesh) {
    console.log("getVisibleSatellites, satInfos=", satInfos);
    let visibleSatellites = [];

    for (let i = 0; i < satInfos.length; i++) {
        let sat = satInfos[i];
        let satMesh = sat.mesh;
        let satPosition = satMesh.position;
        let satVisible = checkIfTargetVisible(currentPosition, satPosition, earthMesh);
        if (satVisible) {
            visibleSatellites.push(sat);
            addLine(scene, currentPosition, satPosition, colorVisible);
        } else {
            addLine(scene, currentPosition, satPosition, colorNotVisible);
        }
    }
    return visibleSatellites;
}

// here it all begins
var createMap = function() {

    scene = new THREE.Scene();

    let light = new THREE.AmbientLight(0xffffff);
    scene.add(light);

    //light = new THREE.DirectionalLight(0xffffff, 1);
    //light.position.set(5, 5, 5);
    //scene.add(light);

    // let camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 1, 10);
    // var camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.001, 100);

    var SCREEN_WIDTH = window.innerWidth;
    var SCREEN_HEIGHT = window.innerHeight;
    var aspect = SCREEN_WIDTH / SCREEN_HEIGHT;
    var frustumSize = 600;

    var camera = new THREE.OrthographicCamera(frustumSize * aspect / -2, frustumSize * aspect / 2, frustumSize / 2, frustumSize / -2, -10000, 10000);
    camera.rotation.y = Math.PI;

    camera.position.x = 0;
    camera.position.y = 0;
    camera.position.z = 1000;
    camera.zoom = 0.040;

    camera.updateProjectionMatrix();

    onRenderFcts.push(function() {
        renderer.render(scene, camera);

    });

    let earthMesh = addEarth(scene);
    addSatellites(scene, satData, onRenderFcts);

    let routeMarkers = addRouteMarkers(scene, satData);
    let startMesh = routeMarkers.startMesh;
    let finishMesh = routeMarkers.finishMesh;

    let renderer = new THREE.WebGLRenderer();
    renderer.setSize(SCREEN_WIDTH, SCREEN_HEIGHT);
    renderer.autoClear = false;

    var camControls = new OrbitControls(camera, renderer.domElement);
    //   camControls.minDistance = 1;
    //    camControls.maxDistance = 64;
    camControls.autoRotate = true;
    camControls.noKeys = false;

    onRenderFcts.push(function(delta, now) {
        camControls.update(delta);

    });

    document.body.appendChild(renderer.domElement);


    // below we do the actual calculation of shortest path between start and finish using the satellites as path

    // satInfos is local global used inside the methods defined below. 
    let satInfos = satData._satData;
    console.log("satDAta=", satInfos);

    let graph = new Graph();

    {
        let visibleSatsFromStart = getVisibleSatellites(startMesh.position, 0x0000ff, 0xff0000, satInfos, earthMesh);
        console.log("visibleSatsFromStart=", visibleSatsFromStart);
        for (let l of visibleSatsFromStart) {
            graph.addEdge("START", l.name);
        }
    } {
        let visibleSatsFromFinish = getVisibleSatellites(finishMesh.position, 0x0000ff, 0xff0000, satInfos, earthMesh);
        console.log("visibleSatsFromFinish=", visibleSatsFromFinish);
        for (let l of visibleSatsFromFinish) {
            graph.addEdge(l.name, "FINISH");
        }
    }

    function seeWhatSatellitesSeeEachOthers() {
        console.log("seeWhatSatellitesSeeEachOthers");
        for (let i = 0; i < satInfos.length; i++) {
            let sat = satInfos[i];
            let satMesh = sat.mesh; // pre populated in addSatellites, mesh.position. xyz
            let satPosition = satMesh.position;
            for (let k = 0; k < satInfos.length; k++) {
                let satVisible = checkIfTargetVisible(satPosition, satInfos[k].mesh.position, earthMesh);
                if (satVisible) {
                    addLine(scene, satPosition, satInfos[k].mesh.position, 0xfefefe);
                    // console.log("adding edge=" + sat.name, satInfos[k].name);
                    graph.addEdge(sat.name, satInfos[k].name);
                } else {
                    // addLine(satPosition, satInfos[k].mesh.position, 0xff0000);
                }
            }
        };
    }

    // find the route from start to finish by using raytracing
    seeWhatSatellitesSeeEachOthers();
    graph.prints("Calculating shortest path to transmit from START to FINISH.... Please stand by...");
    graph.bfs('START');
    graph.prints();
    let shortestPath = graph.shortestPath("START", "FINISH");

    // build a line that follows the shortest path
    let startToFinishGeometry = new THREE.Geometry();

    startToFinishGeometry.vertices.push(
        startMesh.position
    );
    let material = new THREE.LineBasicMaterial({
        color: 0x00aeff,
        linewidth: 3,
        blending: THREE.AdditiveBlending,
        transparent: true,
        antialias: true

    });
    let startPoint = startMesh.position;
    let visualizationPoints = [];

    for (let satName of shortestPath) {
        let sat = satInfos.find(x => x.name === satName);
        if (!sat) continue;
        startToFinishGeometry.vertices.push(
            sat.mesh.position);

        let endPoint = sat.mesh.position;

        let d = (startPoint.distanceTo(endPoint) * 0.02 + 6) * 2;
        console.log("d=", d);
        visualizationPoints = visualizationPoints.concat(createLinePoints(startPoint, endPoint, d));
        startPoint = endPoint;

    }

    visualizationPoints = visualizationPoints.concat(createLinePoints(startPoint, finishMesh.position, 10));


    startToFinishGeometry.vertices.push(
        finishMesh.position
    );
    let startToFinishLine = new THREE.Line(startToFinishGeometry, material);

    scene.add(startToFinishLine);

    // add some particles that follow the line from FINISH to END
    addParticles(visualizationPoints, onRenderFcts, scene);

    // print the results to console and to some browser tag
    console.log("shortestPath=", shortestPath);
    graph.prints(satData.SEED);
    graph.prints("Use mouse to rotate, zoom and pan around.");

    // execute onRenderFcts
    let lastTimeMsec = null;
    requestAnimationFrame(function animate(nowMsec) {
        // keep looping
        requestAnimationFrame(animate);
        // measure time
        lastTimeMsec = lastTimeMsec || nowMsec - 1000 / 60;
        let deltaMsec = Math.min(200, nowMsec - lastTimeMsec);
        lastTimeMsec = nowMsec;
        // call each update function
        onRenderFcts.forEach(function(onRenderFct) {
            onRenderFct(deltaMsec / 1000, nowMsec / 1000);
        });
    });

};
