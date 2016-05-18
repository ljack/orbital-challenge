import {
    THREE
}
from 'three';

export function addLine(scene,startPosition, endPosition, color) {
    let geometry = new THREE.Geometry();
    geometry.vertices.push(
        startPosition,
        endPosition
    );
    let material = new THREE.LineBasicMaterial({
        color: color
    });
    let line = new THREE.Line(geometry, material);
    scene.add( line);
    return line;
}

export function p(object) {
    return JSON.stringify(object);
}

/*
 lat,long co-ordinates
 alt = altitude / radius, 
 add 1 is earth surface, 1.100 is 100 km above earth surface, sot put something in earth give alt 100
 returns {x: , y: , z: }
*/
export function llaToXYZ(lat, lon, alt) {

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
