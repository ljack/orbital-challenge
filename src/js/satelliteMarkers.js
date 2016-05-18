import {
    THREE
}
from 'three';

import {
    llaToXYZ
}
from './util.js';
import {
    EARTH_RADIUS
}
from './earth.js';

import {
    SpriteText2D, Text2D, textAlign
}
from 'three-text2d';

export function addSatellites(scene, satData, onRenderFcts) {

    let geometry = new THREE.BoxGeometry(20, 20, 20);
    let material = new THREE.MeshPhongMaterial({
        map: new THREE.TextureLoader().load('images/gold_energy.jpg')
    });
    let satellites = satData._satData; // name, lat,long,alt
    console.log("satData=", satData);

    // for (let i = 0; i < satellites.length; i++) {
    for( let sat of satellites ) {
        let mesh = new THREE.Mesh(geometry, material);
        // let sat = satellites[i];

        // convert lat lon alt to x,y,z
        let salt = parseFloat(EARTH_RADIUS) + parseFloat(sat.alt);

        let pos = llaToXYZ(sat.lat, sat.lon, salt);
        sat.mesh = mesh;

        mesh.position.z = pos.z;
        mesh.position.x = pos.x;
        mesh.position.y = pos.y; 
        console.log("sat " + sat.name  + " placed at position x:" + pos.x, " y:" + pos.y + " z:" + pos.z + " salt=" + salt);
        // satellites[i] = sat;
        scene.add(mesh);

        var sprite = new SpriteText2D(sat.name, {
            align: textAlign.center,
            font: '400px Arial',
            fillStyle: '#ffffff',
            antialias: true
        });
        
        sprite.position.set(pos.x, pos.y, pos.z*1.15);
        sprite.scale.set( 1.5,1.5,1.5);
        scene.add(sprite)



        // add some rotation for visual niceness
        onRenderFcts.push(function(delta, now) {
            const speed = 4;
            mesh.rotation.z += 1 / speed * delta;
            mesh.rotation.x += 1 / speed * delta;
            mesh.rotation.y += 1 / speed * delta;
        });
    }
    return satellites;

};