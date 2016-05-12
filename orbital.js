/*  global THREE */
let onRenderFcts = [];

const EARTH_RADIUS = 6371;
let SEED = "";

const SATELLITE_POSITIONS_HEADER = "name,lat,lon,alt";
let SATELLITE_POSITIONS = `name,lat,lon,alt
SAT0,36.20355830226454,48.13703377339229,359.2479771000116
SAT1,30.77964873161345,-28.711708853429002,342.47692534683705
SAT2,82.03447348027447,-64.36686639561222,335.3947261893395
SAT3,-8.988902231761799,142.1610960003672,629.0397042922036
SAT4,-83.51330102365031,119.21050064075769,525.1837403451229
SAT5,-38.8346333542903,-175.53488681959934,609.7910635352318
SAT6,58.94067418487978,-138.46586436219042,588.938574483838
SAT7,-15.730062268272533,-6.823654528970451,575.0713773070536
SAT8,-28.82347164906922,81.40578252851532,599.5864459652598
SAT9,-47.55394726015829,0.9285718861989665,484.13567350912035
SAT10,50.78164526411865,-157.63630799243867,554.9388114941785
SAT11,61.12786810164016,-9.01711693824177,328.40597446843697
SAT12,67.08022039586155,-166.73320467881072,639.1103158064834
SAT13,43.53794951752079,28.946160515202195,635.9168389149887
SAT14,32.17020980766662,2.8429935653013843,623.3792713608332
SAT15,-24.3282098360648,124.2422211739862,596.3032776634826
SAT16,14.141474688186193,113.83796349942509,662.6586399241478
SAT17,-65.13026730470396,-33.87096022227101,432.29430053216004
SAT18,19.396137379872414,-140.63510282455348,380.6664360408779
SAT19,-3.738110528034767,-158.01971644278632,474.1328837479838`;

const ROUTE_HEADER = "route,lat1,lon1,lat2,lon2";
let ROUTE = ""; //  "ROUTE,40.7142700,-74.0059700,52.5243700,13.4105300";

let startMesh;
let finishMesh;
let satInfos = [];
let earthMesh = null;
let route;
let xhr = new XMLHttpRequest();
xhr.open('GET', 'https://space-fast-track.herokuapp.com/generate', true); // load data
xhr.onreadystatechange = function(e) {
    if (xhr.readyState === 4) {
        if (xhr.status === 200) {
            console.log(" satellite data received " + xhr.responseText);
            let rows = xhr.responseText.split("\n");
            // 1. row is seed, pos 0
            // rows 2 - 20 is satellite info
            // row 21 is route, pos 20
            SEED = rows[0];
            console.log("SEED=", SEED);

            ROUTE = ROUTE_HEADER + "\n" + rows[rows.length - 1];
            // ROUTE = ROUTE_HEADER + "\n" + ROUTE;

            console.log("ROUTE=", ROUTE);
            SATELLITE_POSITIONS = SATELLITE_POSITIONS_HEADER + "\n" + rows.splice(1, rows.length - 2).join("\n");
            console.log("SATELLITE_POSITIONS=", SATELLITE_POSITIONS);
            // kick the system and start working
            route = csvJSON(ROUTE)[0];
            createMap();
        }
    }
};
xhr.send(null);

function addLine(startPosition, endPosition, color) {
    let geometry = new THREE.Geometry();
    geometry.vertices.push(
        startPosition,
        endPosition
    );
    let material = new THREE.LineBasicMaterial({
        color: color
    });
    let line = new THREE.Line(geometry, material);
    scene.add(line);
}

function p(object) {
    return JSON.stringify(object);
}

/*
 lat,long co-ordinates
 alt = altitude / radius, 
 add 1 is earth surface, 1.100 is 100 km above earth surface, sot put something in earth give alt 100
 returns {x: , y: , z: }
*/
let llaToXYZ = function(lat, lon, alt) {

    // alt is from 0,0,0 (so it's just radius)
    let radius = parseFloat(alt);
    var phiFrom = lat * Math.PI / 180;
    var thetaFrom = (lon + 90) * Math.PI / 180;

    var xF = radius * Math.cos(phiFrom) * Math.sin(thetaFrom);
    var yF = radius * Math.sin(phiFrom);
    var zF = radius * Math.cos(phiFrom) * Math.cos(thetaFrom);
    // maybe return THREE.Vector3 also from here
    return {
        x: xF,
        y: yF,
        z: zF,
    };
};

//var csv is the CSV file with headers
let csvJSON = function(csv) {
    var lines = csv.split("\n");
    var result = [];
    var headers = lines[0].split(",");
    for (var i = 1; i < lines.length; i++) {
        var obj = {};
        var currentline = lines[i].split(",");
        for (var j = 0; j < headers.length; j++) {
            obj[headers[j]] = currentline[j];
        }
        result.push(obj);
    }
    return result; //JavaScript object
    //return JSON.stringify(result); //JSON
};

let getSatData = function() {
    let res = csvJSON(SATELLITE_POSITIONS);
    return res;
};

let addRouteMarkers = function() {
    let markerSize = 2;
    let geometry = new THREE.BoxGeometry(markerSize, markerSize, markerSize);
    let material = new THREE.MeshPhongMaterial({
        // replace with some nice satellite antenna model..
        map: new THREE.TextureLoader().load('images/crate.jpg')
    });

    // start marker
    startMesh = new THREE.Mesh(geometry, material);
    let markerHeight = parseFloat(EARTH_RADIUS) + parseFloat(1);
    let pos = llaToXYZ(route.lat1, route.lon1, markerHeight);
    console.log("start marker position ", pos);
    startMesh.position.z = pos.z;
    startMesh.position.x = pos.x;
    startMesh.position.y = pos.y;
    scene.add(startMesh);

    // finish marker
    finishMesh = new THREE.Group();
    let x = new THREE.Mesh(geometry, material);
    finishMesh.add(x);
    pos = llaToXYZ(route.lat2, route.lon2, markerHeight);
    console.log("finish marker position ", pos);
    finishMesh.position.z = pos.z;
    finishMesh.position.x = pos.x;
    finishMesh.position.y = pos.y;
    scene.add(finishMesh);

    // add some basic markers visible from space ;)
    addLine(startMesh.position, startMesh.position.clone().multiplyScalar(2), 0x00fefe);
    addLine(finishMesh.position, finishMesh.position.clone().multiplyScalar(2), 0xfefe00);

};


let addSatellites = function() {

    let geometry = new THREE.BoxGeometry(2, 2, 2);
    let material = new THREE.MeshPhongMaterial({
        map: new THREE.TextureLoader().load('images/gold_energy.jpg')
    });
    let satellites = getSatData(); // name, lat,long,alt

    for (let i = 0; i < satellites.length; i++) {
        let mesh = new THREE.Mesh(geometry, material);
        let sat = satellites[i];

        // convert lat lon alt to x,y,z
        let salt = parseFloat(EARTH_RADIUS) + parseFloat(sat.alt);

        let pos = llaToXYZ(sat.lat, sat.lon, salt);
        sat.mesh = mesh;

        mesh.position.z = pos.z;
        mesh.position.x = pos.x;
        mesh.position.y = pos.y;
        console.log("sat #" + i + " placed at position x:" + pos.x, " y:" + pos.y + " z:" + pos.z + " salt=" + salt);
        satInfos[i] = sat;

        scene.add(mesh);

        // add some rotation for visual niceness
        onRenderFcts.push(function(delta, now) {
            const speed = 4;
            mesh.rotation.z += 1 / speed * delta;
            mesh.rotation.x += 1 / speed * delta;
            mesh.rotation.y += 1 / speed * delta;
        });
    }
};




let earth = function() {

    let phiStart = 3 / 2 * Math.PI;
    let geometry = new THREE.SphereGeometry(EARTH_RADIUS, 32, 32, phiStart);

    let material = new THREE.MeshPhongMaterial();
    // material.side = THREE.DoubleSide;
    material.map = new THREE.TextureLoader().load('images/2_no_clouds_4k.jpg');
    // material.map.offset.x = 0.5;
    //  material.map.offset.y = 0.5;

    //    material.bumpMap = new THREE.TextureLoader().load('images/earthbump1k.jpg');
    // material.bumpScale = 0.05;
    //    material.specularMap = new THREE.TextureLoader().load('images/earthspec1k.jpg');
    //   material.specular = new THREE.Color('grey');


    earthMesh = new THREE.Mesh(geometry, material);
    // earthMesh.rotateZ(20 * Math.PI / 180)

    scene.add(earthMesh);

    // too confusing for snapshot mode if the earth rotates ;)
    // onRenderFcts.push(function(delta, now) {
    //     earthMesh.rotation.y += 1 / 32 * delta;
    // });
};


// here it all begins
var createMap = function() {

    /*global scene*/
    scene = new THREE.Scene();

    let light = new THREE.AmbientLight(0xffffff);
    scene.add(light);

    light = new THREE.DirectionalLight(0xffffff, 1);
    light.position.set(5, 5, 5);
    scene.add(light);

    // let camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 1, 10);
    // var camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.001, 100);

    var SCREEN_WIDTH = window.innerWidth;
    var SCREEN_HEIGHT = window.innerHeight;
    var aspect = SCREEN_WIDTH / SCREEN_HEIGHT;
    var frustumSize = 600;

    var camera = new THREE.OrthographicCamera(frustumSize * aspect / -2, frustumSize * aspect / 2, frustumSize / 2, frustumSize / -2, -10000, 10000);
    // camera.aspect = 0.5 * aspect;
    camera.rotation.y = Math.PI;
    // camera.up.set( 0, 0, 1 );
    // camera.position.z = 10000;
    // camera.zoom = -100;
    // camera.position.z = 2500;
    // var cameraOrthoHelper = new THREE.CameraHelper(camera);
    // scene.add(cameraOrthoHelper);
    camera.updateProjectionMatrix();

    onRenderFcts.push(function() {
        renderer.render(scene, camera);
    });

    addSatellites();
    earth();
    addRouteMarkers();

    let renderer = new THREE.WebGLRenderer();
    renderer.setSize(SCREEN_WIDTH, SCREEN_HEIGHT);

    renderer.autoClear = false;

    var camControls = new THREE.OrbitControls(camera, renderer.domElement);
    camControls.minDistance = 1;
    camControls.maxDistance = 64;
    camControls.autoRotate = true;
    camControls.noKeys = false;
    onRenderFcts.push(function(delta, now) {
        camControls.update(delta);
    });

    // var camControls = new THREE.FirstPersonControls(camera);
    // onRenderFcts.push(function(delta, now) {
    //     camControls.update(delta);
    // });

    // camera.position.x = start.x;
    // camera.position.y = start.y;
    // camera.position.z = start.z;


    function checkIfTargetVisible(fromPosition, targetPosition) {
        if (fromPosition.equals(targetPosition)) return false;

        let raycaster = new THREE.Raycaster();
        let direction = new THREE.Vector3();

        direction.subVectors(targetPosition, fromPosition);

        raycaster.set(fromPosition, direction.normalize());
        // just check if earth is blocking los
        let intersects = raycaster.intersectObject(earthMesh);

        // console.log(`from: ${p(fromPosition)} to:${p(targetPosition)} intersects=${intersects.length}`);
        return intersects == 0;

    }


    document.body.appendChild(renderer.domElement);

    // cycle through satellites
    let getVisibleSatellites = function(currentPosition, colorVisible = 0xfefefe, colorNotVisible = 0xff0000) {

        let visibleSatellites = [];
        for (let i = 0; i < satInfos.length; i++) {
            let sat = satInfos[i];
            let satMesh = sat.mesh;
            let satPosition = satMesh.position;
            let satVisible = checkIfTargetVisible(currentPosition, satPosition);
            if (satVisible) {
                visibleSatellites.push(sat);
                addLine(currentPosition, satPosition, colorVisible);
            } else {
                addLine(currentPosition, satPosition, colorNotVisible);
            }
        }
        return visibleSatellites;
    };

    function addToGraph(graph, left, array) {
        for (let l of array) {
            graph.addEdge(left, l.name);
        }
    }

    let graph = new Graph();

    let visibleSatsFromStart = getVisibleSatellites(startMesh.position, 0x0000ff);
    console.log("visibleSatsFromStart=", visibleSatsFromStart);
    addToGraph(graph, "START", visibleSatsFromStart);

    let visibleSatsFromFinish = getVisibleSatellites(finishMesh.position, 0x0000ff);
    console.log("visibleSatsFromFinish=", visibleSatsFromFinish);
    for (let l of visibleSatsFromFinish) {
        graph.addEdge(l.name, "FINISH");
    }


    function seeWhatSatellitesSeeEachOthers() {
        for (let i = 0; i < satInfos.length; i++) {
            let sat = satInfos[i];
            let satMesh = sat.mesh; // pre populated in addSatellites, mesh.position.xyz
            let satPosition = satMesh.position;
            for (let k = 0; k < satInfos.length; k++) {
                let satVisible = checkIfTargetVisible(satPosition, satInfos[k].mesh.position);
                if (satVisible) {
                    addLine(satPosition, satInfos[k].mesh.position, 0xfefefe);
                    graph.addEdge(sat.name, satInfos[k].name);
                } else {
                    // addLine(satPosition, satInfos[k].mesh.position, 0xff0000);
                }
            }
        };
    }
    
    seeWhatSatellitesSeeEachOthers();
    bfs(graph, 'START');
    print();
    shortestPath(graph, "START", "FINISH");
    print(SEED);
    
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
