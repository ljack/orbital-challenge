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
let ROUTE = "ROUTE,2.941889873027648,-137.08756776291935,12.764602805770068,91.93863948321206";



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
            console.log("ROUTE=", ROUTE);
            SATELLITE_POSITIONS = SATELLITE_POSITIONS_HEADER + "\n" + rows.splice(1, rows.length - 2).join("\n");
            console.log("SATELLITE_POSITIONS=", SATELLITE_POSITIONS);
            // kick the system and start working
            createMap();
        }
    }
};
xhr.send(null);


/*
 lat,long co-ordinates
 alt = altitude / radius, 
 add 1 is earth surface, 1.100 is 100 km above earth surface, sot put something in earth give alt 100
 returns {x: , y: , z: }
*/
let llaToXYZ = function(lat, lon, alt) {
    // alt 1 + ( 100 / 100 ); 1+
    let radius = 1 + (alt / 100);

    let phi = (90 - lat) * (Math.PI / 180);
    let theta = (lon + 180) * (Math.PI / 180);

    let x = -((radius) * Math.sin(phi) * Math.cos(theta));
    let z = ((radius) * Math.sin(phi) * Math.sin(theta));
    let y = ((radius) * Math.cos(phi));
    return {
        x: x,
        y: y,
        z: z
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

var getRoute = function() {
    let route = ROUTE_HEADER + "\n" + ROUTE;
    return csvJSON(route)[0];
};

const route = getRoute();
const start = llaToXYZ(route.lat1, route.lon1, 0);
const finish = llaToXYZ(route.lat2, route.lon2, 0);


let getSatData = function() {
    let res = csvJSON(SATELLITE_POSITIONS);
    return res;
};

var startMesh;
var finishMesh;
 
let addRouteMarkers = function() {
    let geometry = new THREE.BoxGeometry(0.2, 0.2, 0.2);
    let material = new THREE.MeshPhongMaterial({
        map: THREE.ImageUtils.loadTexture('images/crate.jpg')
    });

     startMesh = new THREE.Mesh(geometry, material);

    let pos = llaToXYZ(route.lat1, route.lon1, 0);
    console.log("pos", pos);
    startMesh.position.z = pos.z;
    startMesh.position.x = pos.x;
    startMesh.position.y = pos.y;
    scene.add(startMesh);

    finishMesh = new THREE.Group();
    let x = new THREE.Mesh(geometry, material);
    finishMesh.add(x);
    pos = llaToXYZ(route.lat2, route.lon2, 0);

    finishMesh.position.z = pos.z;
    finishMesh.position.x = pos.x;
    finishMesh.position.y = pos.y;
    scene.add(finishMesh);


};


let addSatellites = function() {

    // var loader = new THREE.STLLoader();
    // loader.load('./models/Astre-main3.lwo', function(geometry) {
    //     let material = new THREE.MeshPhongMaterial({
    //         color: 0xff5533,
    //         specular: 0x111111,
    //         shininess: 200
    //     });
    //     let mesh = new THREE.Mesh(geometry, material);
    //     mesh.position.set(0, -0.25, 0.6);
    //     mesh.rotation.set(0, -Math.PI / 2, 0);
    //     mesh.scale.set(0.5, 0.5, 0.5);
    //     mesh.castShadow = true;
    //     mesh.receiveShadow = true;
    //     scene.add(mesh);
    // });



    let geometry = new THREE.BoxGeometry(0.2, 0.2, 0.2);
    let material = new THREE.MeshPhongMaterial({
        map: THREE.ImageUtils.loadTexture('images/gold_energy.jpg')
    });


    let satellites = getSatData(); // name, lat,long,alt
    //console.log("sats", satellites);

    for (let i = 0; i < satellites.length; i++) {
        let mesh = new THREE.Mesh(geometry, material);
        let sat = satellites[i];

        // convert lat lon alt to x,y,z
        let lat = sat.lat;
        let lon = sat.lon;
        let radius = 1 + (sat.alt / 100);

        let phi = (90 - lat) * (Math.PI / 180);
        let theta = (lon + 180) * (Math.PI / 180);

        let x = -((radius) * Math.sin(phi) * Math.cos(theta));
        let z = ((radius) * Math.sin(phi) * Math.sin(theta));
        let y = ((radius) * Math.cos(phi));

        console.log("sat=" + JSON.stringify(sat) + " placed at position x:" + x, " y:" + y + " z:" + z);

        mesh.position.z = z;
        mesh.position.x = x;
        mesh.position.y = y;

        // store the position as this is snapshot world (except some rotation) where nothing moves so we can reuse this later
        sat.mesh = mesh;
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


var earthMesh = null;

let earth = function() {
    let geometry = new THREE.SphereGeometry(1, 32, 32);

    let material = new THREE.MeshPhongMaterial();
    material.side = THREE.DoubleSide;
    material.map = THREE.ImageUtils.loadTexture('images/earthmap1k.jpg');
    material.bumpMap = THREE.ImageUtils.loadTexture('images/earthbump1k.jpg');
    material.bumpScale = 0.05;
    material.specularMap = THREE.ImageUtils.loadTexture('images/earthspec1k.jpg');
    material.specular = new THREE.Color('grey');

    earthMesh = new THREE.Mesh(geometry, material);
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
    var frustumSize = 100;

    var camera = new THREE.OrthographicCamera(frustumSize * aspect / -2, frustumSize * aspect / 2, frustumSize / 2, frustumSize / -2, -100, 1000);
    // camera.aspect = 0.5 * aspect;
    camera.rotation.y = Math.PI;
    // camera.zoom = 63;
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
    camControls.noKeys = true;
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

    // aim to first satellite
    var watchingSatellite = 0;
    var path = [];
    var raycaster = new THREE.Raycaster();
    var currentPos = start;

    // cycle through satellites
    let cycleSatellites = function() {
        // look at finish, if visible we're done 
        // check if current satellite is visible and move there
        // point camera to a new satellite in the list
        let satData = getSatData();

        if (watchingSatellite > -1 && earthMesh) {
            // 1. look for destination / aka finish

            // camera.lookAt(new THREE.Vector3(finish.x, finish.y, finish.z));
            raycaster.set(camera.position, camera.getWorldDirection().normalize());
            let obstactlesOnTheWayToHome = raycaster.intersectObject(earthMesh);
            if (obstactlesOnTheWayToHome.length < 1) {
                // we found the path
                console.log("FINISH TARGET VISIBLE! WE CAN GO HOME! Path travelled " + path);
                camera.position.x = finish.x;
                camera.position.y = finish.y;
                camera.position.z = finish.z;
                return;
            } else {
                console.log("Finish target not visible, must keep searching...");
                let target = satData[watchingSatellite];
                let tc = llaToXYZ(target.lat, target.lon, target.alt);
                // camera.lookAt(new THREE.Vector3(tc.x, tc.y, tc.z));
            }

            // now let's try to locate ground station 2 / aka finish
            raycaster.set(camera.position, camera.getWorldDirection().normalize());
            let intersects = raycaster.intersectObject(earthMesh);
            console.log("intersects=", intersects);
            if (intersects.length < 1) {
                let visibleTarget = satData[watchingSatellite];
                path.push("" + visibleTarget.name);
                console.log("yihaa, we found satellite! let's move to there! Path travelled " + path);

                let tc = llaToXYZ(visibleTarget.lat, visibleTarget.lon, visibleTarget.alt);
                // camera.position.x = tc.x;
                // camera.position.y = tc.y;
                // camera.position.z = tc.z;


            }

        }

        // let's find another satellite to look at
        watchingSatellite++;

        if (watchingSatellite > satData.length - 1) watchingSatellite = 0;
        // console.log(`Looking at satellite ${watchingSatellite}, data=${JSON.stringify(tc)} `);

        let target = satData[watchingSatellite];
        let tc = llaToXYZ(target.lat, target.lon, target.alt);
        // camera.lookAt(new THREE.Vector3(tc.x, tc.y, tc.z));


        setTimeout(cycleSatellites, 10000);
    };

    cycleSatellites();
    document.body.appendChild(renderer.domElement);





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
