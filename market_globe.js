/**    WebGL Market Globe - Version 2.1
 *     Interactive 3D Global Financial Market Analysis Tool
 *     based on WebGL Globe by Data Arts Team, Google Creative Lab
 *     Custom Market Globe Code by Ryan Molecke
 *
 * Copyright 2011 Data Arts Team, Google Creative Lab
 *  - Google codebase for this project: http://dataarts.github.com/dat.globe
 *
 * Copyright 2015 Ryan Molecke for Market Globe Alterations
 *  - added stars, clouds, cities, update Three.js version to r71 (May 2015)
 *  - extensive code debugging but still browser texture GC / memory issues if you reload too fast
 *
 * Licensed under the Apache License, Version 2.0 (the 'License');
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 */

var DAT = DAT || {};
var topCount = 12;  // default number of floating stock symbols to show
var myScale = 0.5;  // default scale numerator for listing line heights
var numCats = 2;    // this is the number of categories of views so far (i.e. marketcap, price, etc...)
var numFrames = 1;  // the number of timeframes implemented so far, gets updated as data loads
var mstep = 3;      // number of entries per company in company listing array
var step = 3;       // number of entries per company in MCAP / Price arrays
var mlength = 0;  // number of total companies in the file-read list
var myTexts = []; // array of text flags ( should be vector )
var myScale = 0.5;  // default scale numerator for listing line heights
var updateCheck = 0;
var thisFrame = 0;
var mouseDown = 0;
var myMouse = [];
var mouseDown = 0;
var mouseRightDown = 0;
myMouse.x = 1600;
myMouse.y = 1600;
var myopts = [];
var mActive = [];
var pActive = [];
var cActive = [];
var mChange = [];
var pChange = [];
var newopts = [];
var myFlags = []; // holds numFrames frames for each category
var myFlagStubs = []; // holds only 1 frame for each category
var stubsQ = 0;
var activeCount = 0;
var movementMultiplier = 5; // this accentuates percentChange
var myGeom = 0;
var maxMSize = 0;
var maxPSize = 0;
var coListings = {}; // indexed array of company listing objects
var lastTime = 0;
var lastIntersect;
var thisCoInd = -1; // index of last company onMouseOver'ed
var thisName, thisAddr;
var subgeo;
var submat;
var gameControlsEnabled = 1;

function setHSV(color, h, s, v) {
	//ripped from /examples/js/math/ColorConverter.js, easier/faster than including the whole file.
	return color.setHSL(h, (s * v) / ((h = (2 - s) * v) < 1 ? h : (2 - h)), h * 0.5);
}

DAT.Globe = function (container, colorFn) {
	colorFn = colorFn || function (x) {
//    ColorConverter.setHSV( c, h, s, v )
//    THREE.ColorConverter.setHSV( c, ( 0.6 - ( x * 0.5 ) ), 1.0, 1.0 ); // update for note in r56->57 three.js repo
		var c = new THREE.Color();
		// color by percent change in stock price
		if (parseFloat(x) > 0) {
			setHSV(c, 0.4, 3 * Math.pow(x / maxcolor, 1 / 3), 1.0);
		} else if (x < 0) {
			setHSV(c, 0, 3 * Math.pow(x / mincolor, 1 / 3), 1.0);
		} else {
			setHSV(c, 0.4, 0.01, 1.0);
		}
		return c;
	};
	var Shaders = {
		'earth': {
			uniforms: {
				'texture': {type: 't', value: null}
			},
			vertexShader: [
				'varying vec3 vNormal;',
				'varying vec2 vUv;',
				'void main() {',
				'gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );',
				'vNormal = normalize( normalMatrix * normal );',
				'vUv = uv;',
				'}'
			].join('\n'),
			fragmentShader: [
				'uniform sampler2D texture;',
				'varying vec3 vNormal;',
				'varying vec2 vUv;',
				'void main() {',
				'vec3 diffuse = texture2D( texture, vUv ).xyz;',
				'float intensity = 1.05 - dot( vNormal, vec3( 0.0, 0.0, 1.0 ) );',
				'vec3 atmosphere = vec3( 1.0, 1.0, 1.0 ) * pow( intensity, 3.0 );',
				'gl_FragColor = vec4( diffuse + atmosphere, 1.0 );',
				'}'
			].join('\n')
		},
		'atmosphere': {
			uniforms: {},
			vertexShader: [
				'varying vec3 vNormal;',
				'void main() {',
				'vNormal = normalize( normalMatrix * normal );',
				'gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );',
				'}'
			].join('\n'),
			fragmentShader: [
				'varying vec3 vNormal;',
				'void main() {',
				'float intensity = pow( 0.8 - dot( vNormal, vec3( 0, 0, 1.0 ) ), 12.0 );',
				'gl_FragColor = vec4( 1.0, 1.0, 1.0, 1.0 ) * intensity;',
				'}'
			].join('\n')
		}
	};
	var camera, scene, projector, sceneAtmosphere, renderer, w, h;
	var vector, mesh, atmosphere, point;
	var overRenderer;
	var imgDir = './';
	var curZoomSpeed = 0;
	var zoomSpeed = 50;
	var mouse = {x: 0, y: 0}, mouseOnDown = {x: 0, y: 0};
	var rotation = {x: Math.PI * 12 / 8, y: Math.PI / 7.0},
	target = {x: Math.PI * 7.5 / 8, y: Math.PI / 7.0};   // this rotation var sets initial camera position
	var initCamRotation, initCamPosition;
	var distance = 9300, distanceTarget = 830;
	var padding = 40;
	var PI_HALF = Math.PI / 2;
	var maxsize;
	var newGeom = 0;
	var geoms = [];
	var maxcolor = 0;
	var mincolor = 0;
	var myPos = [];
	var objects = [];
	var raycaster = new THREE.Raycaster();
	var sphere, clouds, stars;

	var globeLatitudeDelta = 0, globeLongitudeDelta = 0, globeMeridianDelta = 0;
	//var globeLatitudeDeltaOld = 0.3 , globeLongitudeDeltaOld = 0.038, globeMeridianDeltaOld = 0;

	var theXAxis = new THREE.Vector3(1, 0, 0);
	var theYAxis = new THREE.Vector3(0, 1, 0);
	var theZAxis = new THREE.Vector3(0, 0, 1);
	var upWays = new THREE.Vector3(0, 1, 0);
	var sideWays = new THREE.Vector3(1, 0, 0);
	var mouseRotationX = 0;
	var mouseRotationY = 0;

	var zoomDelta = 0;
	var mouseZoomDelta = 0;
	var dollyDelta = 0;
	var pedestalDelta = 0;
	var tiltDelta = 0;
	var panDelta = 0;
	var axialCamRotationDelta = 0;

	var _state;
	var noRevolve = 0;


//  var rotation_matrix_x = new THREE.Matrix4().makeRotationX(globeLongitudeDelta);
//  var rotation_matrix_y = new THREE.Matrix4().makeRotationY(globeLatitudeDelta);
//  var rotation_matrix_z = new THREE.Matrix4().makeRotationZ(globeMeridianDelta);
//  var oldRotation = new THREE.Matrix4().makeRotationY(Math.PI);

	function init() {
		container.style.color = '#fff';
		container.style.font = '13px/20px Arial, sans-serif';
		var shader, uniforms, material;
		w = container.offsetWidth || window.innerWidth;
		h = container.offsetHeight || window.innerHeight;
		camera = new THREE.PerspectiveCamera(30, w / h, 1, 10000);
		camera.position.z = distance;
		initCamPosition = camera.position.clone();
		initCamRotation = camera.rotation.clone();
		console.log("initCamRotation: " + JSON.stringify(initCamRotation) + ", initCamPosition: " + JSON.stringify(initCamPosition));


		// custom camera controller
//    controls = new THREE.TrackballControls(camera);

//    controls._zoomStart.y = 5;

		vector = new THREE.Vector3();
		scene = new THREE.Scene();
		//sceneAtmosphere = new THREE.Scene();

		clouds = new THREE.Mesh(
						new THREE.SphereGeometry(203, 32, 32),
						new THREE.MeshPhongMaterial({
							map: THREE.ImageUtils.loadTexture('fair_clouds_2k.png'),
							transparent: true
						})
						);
		//clouds.matrixAutoUpdate = true;
		//clouds.updateMatrix();
		//clouds.flipSided = true;
		//clouds.rotation.y = Math.PI;
		scene.add(clouds);

		var geometry = new THREE.SphereGeometry(201, 40, 30);
		shader = Shaders['earth'];
		uniforms = shader.uniforms;
		uniforms['texture'].value = THREE.ImageUtils.loadTexture(imgDir + 'world_lines_cities' + '.jpg');
		material = new THREE.ShaderMaterial({
			uniforms: uniforms,
			vertexShader: shader.vertexShader,
			fragmentShader: shader.fragmentShader
		});
		sphere = new THREE.Mesh(geometry, material);
		sphere.rotation.y = Math.PI;
		sphere.matrixAutoUpdate = true;
		scene.add(sphere);
//    oldRotation = scene.matrix.clone();
//    console.log("oldRotation: " + JSON.stringify(oldRotation));

//    shader = Shaders['atmosphere'];
//    uniforms = THREE.UniformsUtils.clone(shader.uniforms);
//    material = new THREE.ShaderMaterial({
//          uniforms: uniforms,
//          vertexShader: shader.vertexShader,
//          fragmentShader: shader.fragmentShader,
//          side: THREE.BackSide
//        });
//    mesh = new THREE.Mesh(geometry, material);
//    mesh.scale.x = mesh.scale.y = mesh.scale.z = 1.1;
//    mesh.flipSided = true;
//    mesh.matrixAutoUpdate = true;
//    mesh.updateMatrix();
//    sceneAtmosphere.add(mesh);

		scene.add(new THREE.AmbientLight(0xaaaaaa));

		var light = new THREE.DirectionalLight(0xffffff, 0.3);
		light.position.set(5, 3, -5);

		var light2 = new THREE.DirectionalLight(0xffffff, 0.3);
		light2.position.set(-5, -3, 5);

		scene.add(light);
		scene.add(light2);

//    sphere = new THREE.Mesh(
//      new THREE.SphereGeometry(200, 32, 32),
//      new THREE.MeshPhongMaterial({
//	map:         THREE.ImageUtils.loadTexture('WorldMap_outlines1.jpg'),
//	//map:         THREE.ImageUtils.loadTexture('2_no_clouds_4k.jpg'),
//	bumpMap:     THREE.ImageUtils.loadTexture('elev_bump_4k.jpg'),
//	bumpScale:   0.001,
//	specularMap: THREE.ImageUtils.loadTexture('water_4k.png'),
//	specular:    new THREE.Color('grey')
//      })
//    );
//    sphere.rotation.y = Math.PI;
//    //sphere.matrixAutoUpdate = true;
//    //sphere.updateMatrix();
//    scene.add(sphere);

		stars = new THREE.Mesh(
						new THREE.SphereGeometry(1000, 32, 32),
						new THREE.MeshBasicMaterial({
							map: THREE.ImageUtils.loadTexture('galaxy_starfield.png'),
							side: THREE.BackSide
//        transparent: true
						})
						);
		stars.flipSided = true;
		scene.add(stars);


		geometry = new THREE.BoxGeometry(0.75, 0.75, 1);
		geometry.dynamic = true;
		geometry.applyMatrix(new THREE.Matrix4().makeTranslation(0, 0, 0.5));
		point = new THREE.Mesh(geometry, new THREE.MeshFaceMaterial({morphTargets: true}));

		renderer = new THREE.WebGLRenderer({antialias: true});
		renderer.autoClear = false;
		renderer.setClearColor(0x000000, 0.0);
		renderer.setSize(w, h);
		renderer.domElement.style.position = 'absolute';
		container.appendChild(renderer.domElement);
		container.addEventListener('mousedown', onMouseDown, false);
		//container.addEventListener('mousewheel', onMouseWheel, false);

		document.addEventListener('mousewheel', onMouseWheel, false);
		document.addEventListener('DOMMouseScroll', onMouseWheel, false); // firefox
		document.addEventListener('contextmenu', function (event) {
			event.preventDefault();
		}, false);
		document.addEventListener('keydown', onKeyDown, false);
		window.addEventListener('resize', onWindowResize, false);
		container.addEventListener('mouseover', function () {
			overRenderer = true;
		}, false);
		container.addEventListener('mouseout', function () {
			overRenderer = false;
		}, false);
		container.addEventListener('mousemove', onMouseMove, false);
	}

	projector = new THREE.Projector();

	///// READ IN MARKET INDEX DATA HERE //////
	readIndex = function (indexData) {
		indd = indexData.split(",");  // get company names, addresses, lat/lng data, and symbols
		indd.pop(); // there is an extra comma in the index list, pop it off
		for (i = 0; i < indd.length; i += mstep) { // ordered read-in file data
			if (indd[i] === "INDU")
				indd[i] = "^DJI";  // strip out 'INDU' index listing so YQL scrub hack not so apparent
			var thisListing = {lat: indd[i + 1], lng: indd[i + 2]};
			coInd = i / mstep;
			coListings[coInd] = jQuery.extend(true, {}, thisListing); // create array of company objects with their own sub-properties
			coListings[coInd].symbol = indd[i];
			coListings[coInd].mcapFrames = jQuery.extend(true, [], []);        // each company object holds an array of mcap frames
			coListings[coInd].mScaledFrames = jQuery.extend(true, [], []);     // each company object holds an array of SCALED mcap frames
			coListings[coInd].priceFrames = jQuery.extend(true, [], []);       // each company object holds an array of price frames
			coListings[coInd].pScaledFrames = jQuery.extend(true, [], []);     // each company object holds an array of SCALED price frames
			coListings[coInd].ChangeFrames = jQuery.extend(true, [], []);      // each company object holds an array of mcap changeInPercent frames
			coListings[coInd].active = 0;
			coListings[coInd].cactive = 0;
			coListings[coInd].mactive = 0;
			coListings[coInd].pactive = 0;  // these 4 flags get set during update, according to mcap / price limits and ranking
		}
		mlength = indd.length / mstep;  // objects don't have .length property in javascript...
//    for (var coSymbol in coListings){  // this loop demonstrates iteration and setting vars on company listing objects
//       coListings[coSymbol].test = "yes";
//       console.log(" verify symbol : " + coSymbol + ", test result: " + coListings[coSymbol].test);
//       mlength += 1;
//    }
		console.log("added symbol / lat / long data for " + mlength + " company objects");
	};

	// FUNCTION TO INITIALIZE numFrames variable, for live updates / scaling issue
	setNumFrames = function (newNumFrames) {
		numFrames = newNumFrames;
	}

	/////  READ FILE datasets here /////
	///// each dataset holds mcap/price, changeInP, changeInP_ranking for all companies (ordered by mcap/price) for one timestep //////
	addData = function (data, opts, thisFrame) {
		if (updateCheck === 0) { // this re/initializes the mcap/price/change data from the file-read array
			// push the mcap, price, changeInPercent, and changeInPercent ranking data into the company objects
//      console.log("calling addData for frame " + thisFrame + " for " + data.length/step + " company listings");
			for (var i = 0; i < data.length; i += step) { // set color schema red / green
				if (parseFloat(data[i + 2]) < mincolor)
					mincolor = data[i + 2]; // minmax based on changeInPercent from mcap/price array
				if (parseFloat(data[i + 2]) > maxcolor)
					maxcolor = data[i + 2];
				coListings[i / step].mcapFrames[thisFrame] = data[i];           // set mcap data into coListing objects, by frame
				coListings[i / step].priceFrames[thisFrame] = data[i + 1];        // set price data into coListing objects, by frame
				coListings[i / step].ChangeFrames[thisFrame] = data[i + 2];       // set changeInPercent data into coListing objects, by frame
			}
			myopts[thisFrame] = jQuery.extend(true, {}, opts);
		} else {
//      geoms = [];
			var lat, lng, size, color, i, colorFnWrapper, colorFnWrapper1;
			var flagNum = 0;
			var flagStubNum = 0;
			maxsize = 0;
//      console.log("drawing market data for frame : " + thisFrame + ", updateCheck : " + updateCheck);
			opts.animated = opts.animated || false;
			this.is_animated = opts.animated;
			if (opts.animated) {
				if (this._baseGeometry === undefined || myGeom === 0) {
					myFlagStubs[0] = [];
					myFlags[0] = [];
//          console.log("new baseGeometry created" + " thisFrame : " + thisFrame);
					this._baseGeometry = new THREE.Geometry();
				}

				if (this._morphTargetId === undefined || myGeom === 0) {
					this._morphTargetId = 0;
					myGeom = 1;
				} else {
					this._morphTargetId += 1;
				}
				opts.name = opts.name || 'morphTarget' + this._morphTargetId;
			}

			subgeo = new THREE.Geometry();
			listTextCount = 0;
			myFlags[thisFrame + 1] = [];  // flags index offset by 1
			myTexts[thisFrame] = [];
			maxsize = 0;
			size = 0;
			flagNum = 0;
			stubNum = 0;

			for (var coInd in coListings) { // lay points/flags down in a set order, by indKey
				var coListing = coListings[coInd];
				lat = coListing.lat;         // (index into company data array)
				lng = coListing.lng;         // (index into company data array)
				if (thisFrame < numFrames) {
					if ((listSet && coListing.active) || (!listSet && (coListing.mactive && coListing.pactive))) {
						size = coListing.mcapFrames[thisFrame] * mScale * 160;        // add spikes, flags for mcap data frames here
						size *= 1 + movementMultiplier * coListing.ChangeFrames[thisFrame] / 100; // accentuates changeInPercent
						color = colorFn(coListing.ChangeFrames[thisFrame]);
						addPoint(lat, lng, size, color, coInd, subgeo);
						addFlag(lat, lng, size, color, coInd, subgeo, 0, thisFrame + 1);
						flagNum++;
//        } else if((stubsQ === 1) && (thisFrame===0)) { // size not needed for stubs, frame 0 is the first frame of the marketcap data
					} else if (thisFrame === (numFrames - 1)) {
						// size = coListing.mcapFrames[thisFrame]*mScale*160;        // add flags for mcap STUB data frames here, if stubs turned on
						// size *= 1 + movementMultiplier*coListing.ChangeFrames[thisFrame]/100; // accentuates changeInPercent
						color = colorFn(coListing.ChangeFrames[thisFrame]);
						addFlag(lat, lng, 1, color, coInd, subgeo, 1, 0); // stub frame 0 (mcap stubs) instantiated here
						stubNum++;
					}
				} else {
					if ((listSet && coListing.active) || (!listSet && (coListing.mactive && coListing.pactive))) {
						size = coListing.priceFrames[thisFrame - numFrames] * pScale * 160;      // add spikes, flags for price data frames here
						size *= 1 + movementMultiplier * coListing.ChangeFrames[thisFrame - numFrames] / 100; // accentuates changeInPercent
						color = colorFn(coListing.ChangeFrames[thisFrame - numFrames]);
						addPoint(lat, lng, size, color, coInd, subgeo);
						addFlag(lat, lng, size, color, coInd, subgeo, 0, thisFrame + 1);
						flagNum++;
					}
// for mcap and price data, the stubs will always be the same location/color, but this might not be true for all datasets
// for other datasets, the below code would be needed for a unique stub geometry for each category
					/*          else if((stubsQ===1)&&(thisFrame===numFrames)) {  // size not needed for stubs, frame numFrames is the first frame of the price data
					 // size = coListing.priceFrames[thisFrame-numFrames]*pScale*160;      // add flags for price STUB data frames here, if stubs turned on
					 // size *= 1 + movementMultiplier*coListing.ChangeFrames[thisFrame-numFrames]/100; // accentuates changeInPercent
					 color = colorFn(coListing.ChangeFrames[thisFrame-numFrames]);
					 addFlag(lat, lng, 1, color, coInd, subgeo,1,1); // stub frame 1 (price stubs) instantiated here
					 stubNum++;
					 }
					 console.log(" saw " + stubNum + " stub listings for price listing, thisFrame: " + thisFrame);
					 */
				}
				//now create text symbol links for top companies for each timeframe (in each category)
				if (updateCheck === 1) { //we have topList data once all frames have been read & updated within limits
					if (thisFrame < numFrames) { // update market text symbols
						if (listSet) {
							if (coListing.active > 0 && coListing.mactive <= topCount) { // add text symbols for topCount largest mcap colistings within limits
								size = coListing.mcapFrames[thisFrame] * mScale * 160;        // add spikes, flags for mcap data frames here
								size *= 1 + movementMultiplier * coListing.ChangeFrames[thisFrame] / 100; // accentuates changeInPercent
								color = colorFn(coListing.ChangeFrames[thisFrame]);
								addText(lat, lng, size, coListing.symbol, color, coInd, thisFrame);  // grab the company name here (index into company data array)
							}
						} else {
							if (coListing.pactive && coListing.mactive) {
								if (coListing.mactive <= topCount) {
									size = coListing.mcapFrames[thisFrame] * mScale * 160;        // add spikes, flags for mcap data frames here
									size *= 1 + movementMultiplier * coListing.ChangeFrames[thisFrame] / 100; // accentuates changeInPercent
									color = colorFn(coListing.ChangeFrames[thisFrame]);
									addText(lat, lng, size, coListing.symbol, color, coInd, thisFrame);  // grab the company name here (index into company data array)
								}
							}
						}
					} else { // add text symbols for topCount largest price colistings within limits
						if (listSet) {
							if (coListing.active > 0 && coListing.pactive <= topCount) {
								size = coListing.priceFrames[thisFrame - numFrames] * pScale * 160;      // add spikes, flags for price data frames here
								size *= 1 + movementMultiplier * coListing.ChangeFrames[thisFrame - numFrames] / 100; // accentuates changeInPercent
								color = colorFn(coListing.ChangeFrames[thisFrame - numFrames]);
								addText(lat, lng, size, coListing.symbol, color, coInd, thisFrame);  // grab the company name here (index into company data array)
							}
						} else {
							if (coListing.pactive && coListing.mactive) {
								if (coListing.pactive <= topCount) {
									size = coListing.priceFrames[thisFrame - numFrames] * pScale * 160;      // add spikes, flags for price data frames here
									size *= 1 + movementMultiplier * coListing.ChangeFrames[thisFrame - numFrames] / 100; // accentuates changeInPercent
									color = colorFn(coListing.ChangeFrames[thisFrame - numFrames]);
									addText(lat, lng, size, coListing.symbol, color, coInd, thisFrame);  // grab the company name here (index into company data array)
								}
							}
						}
					}
				}

			}
//      console.log(" addData frame " + thisFrame + " for " + flagNum + " companies.");
			if (opts.animated) {
				submat = new THREE.MeshBasicMaterial({
					color: 0xfffffe,
					vertexColors: THREE.FaceColors,
					morphTargets: false,
					transparent: true,
					opacity: 0.9
				});
				this.points = new THREE.Mesh(subgeo, submat);
				geoms.push(this.points);
//        console.log("pushed geom, geoms.length : " + geoms.length);
//        console.log("scene.objects.length: " + scene.objects.length);
			}

			/*
			 if (stubsQ === 1 && thisFrame === 0 ) {
			 console.log(" saw " + stubNum + " stubs, " + flagNum + " active listings company list");
			 stubsQ = 0; // flags were turned on, got reset by update, and need to be restored
			 tStubs();   // so restore them here
			 }
			 */

		} //end if/else updatecheck
	};

	function addPoint(lat, lng, size, color, coInd, subgeo) {
		var phi = (90 - lat) * Math.PI / 180;
		var theta = (180 - lng) * Math.PI / 180;
		point.position.x = 200 * Math.sin(phi) * Math.cos(theta);
		point.position.y = 200 * Math.cos(phi);
		point.position.z = 200 * Math.sin(phi) * Math.sin(theta);
		point.lookAt(sphere.position);
		point.scale.z = -1 * myScale * size;
		for (var i = 0; i < point.geometry.faces.length; i++) {
			point.geometry.faces[i].color = color;
		}
		point.updateMatrix();
		subgeo.merge(point.geometry, point.matrix);
//    console.log("added point with size : " + size + ", color : " + color);
	}

	function addFlag(lat, lng, size, color, ind, subgeo, stub, t) {
		var phi = (90 - lat) * Math.PI / 180;
		var theta = (180 - lng) * Math.PI / 180;
		var phi1 = (80 - lat) * Math.PI / 180;
		var theta1 = (179 - lng) * Math.PI / 180;
		point.position.x = (201 + myScale * size) * Math.sin(phi) * Math.cos(theta);
		point.position.y = (201 + myScale * size) * Math.cos(phi);
		point.position.z = (201 + myScale * size) * Math.sin(phi) * Math.sin(theta);
		var my = [];
		my.x = (201 + myScale * size) * Math.sin(phi1) * Math.cos(theta1);
		my.y = (201 + myScale * size) * Math.cos(phi1);
		my.z = (201 + myScale * size) * Math.sin(phi1) * Math.sin(theta1);
		point.lookAt(my);
		point.updateMatrix();
		addCube(point, size, color, ind, my, stub, t);
//    if(stub) console.log("adding flag stub for symbol " + coListings[ind].symbol + ", lat : " + lat + ", lng " + lng);
	}
	;

	function addCube(p, size, color, ind, lookat, stub, t) {
		//var p1 = JSON.parse(JSON.stringify(p));
		var myGeometry = new THREE.BoxGeometry(0.75, 0.75, 1); //, 1, 1, 1, null, false, { px: true, nx: true, py: true, ny: true, pz: true, nz: true});
		var myMesh = [];
		var material = new THREE.MeshBasicMaterial({
			color: color,
			vertexColors: THREE.FaceColors,
			morphTargets: false,
			transparent: true,
			opacity: 0.9
		});
		myGeometry.applyMatrix(new THREE.Matrix4().makeTranslation(0, 0, -0.5));
		myMesh = new THREE.Mesh(myGeometry, material);
		myMesh.geometry.vector3 = p.geometry.vector3;
		myMesh.position.x = p.position.x;
		myMesh.position.y = p.position.y;
		myMesh.position.z = p.position.z;
//    for (i = 0; i < myMesh.geometry.faces.length; i++) {
//      myMesh.geometry.faces[i].color = color;
//    }
		myMesh.lookAt(lookat);
		if (size / maxsize < 0.02 || stub > 0) {  // stub size
			myMesh.scale.z = 2;
			myMesh.scale.x = 2;
			myMesh.scale.y = 4; // minimum scale for flags and stubs
		} else {
			myMesh.scale.z = 5.5;
			myMesh.scale.x = 1.1;
			myMesh.scale.y = 1.1;
		}

		if (stub > 0) {
			myFlagStubs[t].push({ind: ind, mesh: myMesh, mygeom: myGeometry, mymat: material});
		} else {
			myFlags[t].push({ind: ind, mesh: myMesh, mygeom: myGeometry, mymat: material});
//         console.log("adding flag for symbol " + coListings[ind].symbol + ", size : " + size + ", time : " + t);
		}
	}
	;

	function updateFlags(t) {  // activate onmouseover flags and text symbols according to time selected
		var Slength = myFlagStubs.length;
		if (lastTime > 0 && !(isNaN(t))) {
			if (lastTime !== t) {
//        stubLast = Math.floor((lastTime-1)/numFrames);  // if unique stub geom needed for each cat, uncomment this
//        stubNow = Math.floor((t-1)/numFrames);
				stubLast = 0;
				stubNow = stubLast; // stubs are either "on" or "off" for mcap/price datasets (non-unique)
				//console.log("updating flags for frame " + t + ", stubtime " + stubNow);
				for (var i = 0; i < myFlags[lastTime].length; i++) {  // remove old flags
					scene.remove(myFlags[lastTime][i].mesh);
//          renderer.deallocateObject( myFlags[lastTime][i].mesh );
				}
				if ((stubsQ === 1)) {
					for (var i = 0; i < myFlagStubs[stubLast].length; i++) { // removing stubs if stubs are turned on
						scene.remove(myFlagStubs[stubLast][i].mesh);
					}
				}
				for (var i = 0; i < myTexts[lastTime - 1].length; i++) {
					scene.remove(myTexts[lastTime - 1][i].mesh);
//          renderer.deallocateObject(myTexts[lastTime-1][i].mesh);
				}
				objects = [];
				objectIndices = [];
				for (var i = 0; i < myFlags[t].length; i++) { // restore flags
					scene.add(myFlags[t][i].mesh);
					objects.push(myFlags[t][i].mesh);
					objectIndices.push(myFlags[t][i].ind);
				}
				if ((stubsQ === 1)) { // restore stubs if stubs feature is turned on
					for (var i = 0; i < myFlagStubs[stubNow].length; i++) {
						scene.add(myFlagStubs[stubNow][i].mesh);
						objects.push(myFlagStubs[stubNow][i].mesh);
						objectIndices.push(myFlagStubs[stubNow][i].ind);
					}
				}
				for (var i = 0; i < myTexts[t - 1].length; i++) { // restore floating text symbols
					scene.add(myTexts[t - 1][i].mesh);
					objects.push(myTexts[t - 1][i].mesh);
					objectIndices.push(myTexts[t - 1][i].ind);
				}
				// update geoms here too
				try {
					scene.remove(geoms[lastTime - 1]);
//          renderer.deallocateObject(geoms[lastTime-1]);
				} catch (err) {
				} // remove/restore point object geometry
				scene.add(geoms[t - 1]);
//        console.log("removed geom " + (lastTime-1) + ", added geom " + (t-1) + " to scene");
			}
		}
		lastTime = t;
	}
	;

	tStubs = function tStubs() { // toggle stubbed flags for all the coListings which are not active
//     var stubTime = Math.floor((lastTime-1)/numFrames); // one stubTime frame for each numFrames frames per category
		var stubTime = 0;  // non-unique stubFrames (for mcap/price data)
		console.log("myFlagStubs[" + stubTime + "].length = " + myFlagStubs[stubTime].length);
		if (stubsQ === 0) {
			stubsQ = 1;
			for (var i = 0; i < myFlagStubs[stubTime].length; i++) { // restore flags
				scene.add(myFlagStubs[stubTime][i].mesh);
				objects.push(myFlagStubs[stubTime][i].mesh);
				objectIndices.push(myFlagStubs[stubTime][i].ind);
			}
		} else {
			stubsQ = 0;
			for (var i = 0; i < myFlagStubs[stubTime].length; i++) {
				scene.remove(myFlagStubs[stubTime][i].mesh);
			}
		}
	}

	var winListings = [];
	function updateLists(t) { // updates winner/loser list for selected timeframe, up to 10 winners & 10 losers
		winListings = [];
		var ctx1 = document.getElementById('winners').getContext('2d');
		var yVar = 0;
		ctx1.clearRect(0, 0, document.getElementById('winners').width, document.getElementById('winners').height);
		var frameNum = (t - 1) % numFrames;
		//console.log("updating list, time " + t + ", cActive[" + frameNum + "].length : " + cActive[frameNum].length);
		for (var i = 1; i < 11; i++) { // get list of top ten winners for this timeframe
			if (i > cActive[frameNum].length)
				break;
			var thisInd = cActive[frameNum].length - i;
			var coInd = cActive[frameNum][thisInd].ind;
			var coChange = coListings[coInd].ChangeFrames[frameNum];
			if (coChange < 0)
				break;
			var coPrice = coListings[coInd].priceFrames[frameNum];
			var mcap = coListings[coInd].mcapFrames[frameNum];
			if (mcap > 1000) {
				mcap = Math.round(1000 * mcap) / 1000000 + "B"; // format price listings
			} else if (coPrice > 1) {
				mcap = Math.round(1000 * mcap) / 1000 + "M";
			}
			coChange = "+" + coChange;
			var coColor = "#" + colorHex(colorFn(parseFloat(coChange)));
			if (t - 1 < numFrames)
				coPrice = mcap; //subst mcap in for price for mcap frames
			roundRect(ctx1, 0, yVar * 15, 167, 15, 5, coColor, coListings[coInd].symbol, coPrice, coChange);
			winListings[yVar] = {ind: coInd, symbol: coListings[coInd].symbol}; // set up array for onMouseover to infobox functionality
//     console.log("adding listing for company " + coListings[coInd].symbol);
			yVar = yVar + 1; // increment vertical placement of listings
		}
		for (var i = 10; i > -1; i--) { // get list of top ten loser for this timeframe
			if (i > cActive[frameNum].length - 1)
				continue;
//     var thisInd = cActive[frameNum].length - i;
			var coInd = cActive[frameNum][i].ind;
			var coChange = coListings[coInd].ChangeFrames[frameNum];
			if (coChange > 0)
				continue;
			var coPrice = coListings[coInd].priceFrames[frameNum];
			var mcap = coListings[coInd].mcapFrames[frameNum];
			if (mcap > 1000) {
				mcap = Math.round(1000 * mcap) / 1000000 + "B"; // format price listings
			} else if (coPrice > 1) {
				mcap = Math.round(1000 * mcap) / 1000 + "M";
			}
			var coColor = "#" + colorHex(colorFn(parseFloat(coChange)));
			if (t - 1 < numFrames)
				coPrice = mcap; //subst mcap in for price for mcap frames
			roundRect(ctx1, 0, yVar * 15, 167, 15, 5, coColor, coListings[coInd].symbol, coPrice, coChange);
//     console.log("adding listing for company " + coListings[coInd].symbol + ", yVar " + yVar);
			winListings[yVar] = {ind: coInd, symbol: coListings[coInd].symbol}; // set up array for onMouseover to infobox functionality
			yVar = yVar + 1; // increment vertical placement of listings
		}
//   document.getElementById('winners').style.height = (yVar+1)*15 + 'px';
	}

// create floating text flag
	function addText(lat, lng, size, myText, myColor, ind, t) {
		var text3d = [];
		text3d = new THREE.TextGeometry(myText, {
			size: 6,
			height: 0.5,
			curveSegments: 2,
			font: "helvetiker"
		});
		var loc = [];
		var phi = (90 - lat) * Math.PI / 180;
		var theta = (180 - lng) * Math.PI / 180;
		var phi1 = (90 - lat) * Math.PI / 180;
		var theta1 = (180 - lng) * Math.PI / 180;
		loc.x = (201 + myScale * size) * Math.sin(phi) * Math.cos(theta);
		loc.y = (201 + myScale * size) * Math.cos(phi);
		loc.z = (201 + myScale * size) * Math.sin(phi) * Math.sin(theta);
		var my = [];
		my.x = 221 * Math.sin(phi1) * Math.cos(theta1) - loc.x;
		my.y = 221 * Math.cos(phi1) - loc.y;
		my.z = 221 * Math.sin(phi1) * Math.sin(theta1) - loc.z;
		text3d.computeBoundingBox();
		var thisColor = "0x" + colorHex(myColor);
		var textMaterial = new THREE.MeshBasicMaterial({color: myColor, wireframe: false, transparent: true, opacity: 0.8});
		text = new THREE.Mesh(text3d, textMaterial);
		for (i = 0; i < text.geometry.faces.length; i++) {
			text.geometry.faces[i].color = myColor;
		}
		text.position.x = loc.x;
		text.position.y = loc.y;
		text.position.z = loc.z;
		text.lookAt(my);
		text.rotation.x += 0;
		text.rotation.y += Math.PI;
		text.rotation.z -= (90 - lng) * Math.PI / 180; // this could be tuned a little...
		if (parseFloat(lng) < 0) {
			text.rotation.z -= Math.PI;
		} else if (parseFloat(lat) < 0) {
			text.rotation.z -= Math.PI;  // this symbol rotation algorithm is a hack, but functional
		}
		myTexts[t].push({ind: ind, mesh: text, mygeom: text3d, mymat: textMaterial}); // array of floating text symbols by timeframe, ind & mesh per entry
//    console.log("added text " + myText + ", size " + size + ", time " + t + ", color : " + Math.random() * 0xffffff)
	}
	;

// this sets the scale and 'active' flags for company objects based on whether they fit the limits for mcap/price as specified
	var setscale = 1; // these match the initial scaling params from set_MARKET.php
	var setmscale = 1e6; // these match the initial scaling params from set_MARKET.php
	var maxm = 0;
	var maxp = 0;
	var mystep = step; // this represents (lat,lng,size,percentchange,index) for each company listing in the dataset from set_MARKET
	var mScale = 0;
	var pScale = 0;
	updatePoints = function (newmscale, newscale, newlist, upDown) {
		newopts = [];
		newopts = jQuery.extend(true, [], myopts);
		maxm = 0;
		maxp = 0;
		if (upDown === -1) {
			if (myScale > 0.1) {
				myScale -= 0.1;
				console.log("changed scale down : " + myScale);
			}
		} else if (upDown === 1) {
			myScale += 0.1;
			console.log("changed scale up : " + myScale);
		}
		lastmScale = newmscale;
		lastScale = newscale;
		stubLast = 0;  // for mcap / price data, this is fine (this is frame to clear stubs)
		var infoPanel = document.getElementById("infoPanel");
//    infoPanel.innerHTML = "<font color=white>updating limits, cap: " + newmscale[0] + "," + newmscale[1] + "  price: " + newscale[0] + "," + newscale[1] + "</font>";
		//console.log("updating limits, cap: " + newmscale[0] + "," + newmscale[1] + "  price: " + newscale[0] + "," + newscale[1] + ", setmscale: " + setmscale + ", setscale: " + setscale + ", upDown: " + upDown);
		if (updateCheck) { // remove old scene entities, reset any tracker vars for a new limit update
			try {
				scene.remove(geoms[lastTime - 1]);
			} catch (err) {
				var temp = lastTime - 1;
				console.log("couldn't remove old geom[" + temp + "], geoms.length: " + geoms.length);
			}
			//console.log("attempting to clear old geoms")
			for (geom in geoms) {                  // try to deallocate old mesh, material, geometry here
				geoms[geom].material.dispose();
				//geoms[geom].geometry.deallocate();
				geoms[geom].geometry.dispose();
				//geoms[geom].dispose();
			}
			geoms = [];
			//subgeo.dispose();
			//console.log("attempting to clear old flags, length : " + myFlags[lastTime].length)
			for (var i = 0; i < myFlags[lastTime].length; i++) {  // remove most recent active flags
				scene.remove(myFlags[lastTime][i].mesh);
				//myFlags[lastTime][i].mesh.dispose();
			}
			//console.log("attempting to clear old flags sub-objects : " + myFlags[lastTime].length)
			for (t in myFlags) {
				for (i in myFlags[t]) {
					myFlags[t][i].mygeom.dispose();
					myFlags[t][i].mymat.dispose();
					//myFlags[t][i].mesh.deallocate(); // mesh deallocation no longer explicitly needed?
				}
			}
			if (stubsQ === 1) {
				stubsQ = 0; // reset stubs variable, it will get toggled back on by html update function
			}
			//console.log("attempting to clear old flagstubs, length : " + myFlagStubs[stubLast].length)
			for (var i = 0; i < myFlagStubs[stubLast].length; i++) {  // remove most recent active flags
				scene.remove(myFlagStubs[stubLast][i].mesh);
				//myFlagStubs[stubLast][i].mesh.dispose();
			}
			for (t in myFlagStubs) {
				for (i in myFlagStubs[t]) {
					myFlagStubs[t][i].mygeom.dispose();
					myFlagStubs[t][i].mymat.dispose();
					//myFlagStubs[t][i].mesh.deallocate(); // mesh deallocation no longer explicitly needed?
				}
			}
			myFlagStubs[0] = []; // this is the only stub frame with data currently in use (mcap/price data specific)

			for (var i = 0; i < numFrames + 1; i++) {
				myFlags[i] = []; // delete old flag arrays
			}
			//console.log("attempting to clear old texts, length : " + myTexts[lastTime-1].length)
			for (var i = 0; i < myTexts[lastTime - 1].length; i++) {
				scene.remove(myTexts[lastTime - 1][i].mesh);
				//myTexts[lastTime-1][i].mesh.dispose();
			}
			for (t in myTexts) {
				for (i in myTexts[t]) {
					myTexts[t][i].mygeom.dispose();
					myTexts[t][i].mymat.dispose();
					//myTexts[t][i].mesh.dispose(); // mesh deallocation no longer explicitly needed?
				}
			}
			for (var i = 0; i < numFrames; i++) {
				myTexts[i] = []; // delete old text arrays
			}
			//console.log("attempting final deallocations now.")
			subgeo.dispose();
			submat.dispose();
			objects = [];
			objectIndices = [];
			thisCoInd = -1;
			infoPanel.innerHTML = "";
			winListings = [];
		}
		console.log("Resetting activity flags.")
		for (var coInd in coListings) { // reset activity flags
			coListings[coInd].mactive = 0;
			coListings[coInd].pactive = 0;
			coListings[coInd].cactive = 0;
			coListings[coInd].active = 0;
		}
		var myList = jQuery.extend(true, [], newlist); // get newest symbol list
		if ((myList.length === 0) || (myList[0].toLowerCase() === 'all')) {
			listSet = 0;
		} else {
			listSet = 1;
			for (var i = 0; i < myList.length; i++) {
				var tempName = myList[i].toLowerCase();
				for (var coInd in coListings) {
					if (coListings[coInd].symbol.toLowerCase() === tempName) {
						coListings[coInd].active = 1;
					}
				}
			}
		}
		for (var frameNum = 0; frameNum < numFrames; frameNum++) { // first loop just sets flags for coListings within the new limits
			for (var coInd in coListings) {
				if (parseFloat(coListings[coInd].mcapFrames[frameNum]) >= newmscale[0] / setmscale && parseFloat(coListings[coInd].mcapFrames[frameNum]) <= newmscale[1] / setmscale) {
					coListings[coInd].mactive = 1; // set flags based on current mcap / price limits
				}
				if (parseFloat(coListings[coInd].priceFrames[frameNum]) >= newscale[0] / setscale && parseFloat(coListings[coInd].priceFrames[frameNum]) <= newscale[1] / setscale) {
					coListings[coInd].pactive = 1; // set flags based on current mcap / price limits
				}
			}
		}
		mActive = [];
		pActive = [];
		cActive = [];
		for (var frameNum = 0; frameNum < numFrames; frameNum++) { // now create ranking lists by frame, get max listings for scaling
			mTemp = [];
			pTemp = [];
			cTemp = [];
			for (var coInd in coListings) {
				if (listSet) {
					if (coListings[coInd].active) {
						mTemp.push({ind: coInd, val: coListings[coInd].mcapFrames[frameNum]});
						pTemp.push({ind: coInd, val: coListings[coInd].priceFrames[frameNum]});
						cTemp.push({ind: coInd, val: coListings[coInd].ChangeFrames[frameNum]});
						if (coListings[coInd].mcapFrames[frameNum] > maxm)
							maxm = coListings[coInd].mcapFrames[frameNum];
						if (coListings[coInd].priceFrames[frameNum] > maxp)
							maxp = coListings[coInd].priceFrames[frameNum];
					}
				} else if (coListings[coInd].mactive && coListings[coInd].pactive) {
					mTemp.push({ind: coInd, val: coListings[coInd].mcapFrames[frameNum]});
					pTemp.push({ind: coInd, val: coListings[coInd].priceFrames[frameNum]});
					cTemp.push({ind: coInd, val: coListings[coInd].ChangeFrames[frameNum]});
					if (coListings[coInd].mcapFrames[frameNum] > maxm)
						maxm = coListings[coInd].mcapFrames[frameNum];
					if (coListings[coInd].priceFrames[frameNum] > maxp)
						maxp = coListings[coInd].priceFrames[frameNum];
				}
			}
			mTemp.sort(function (a, b) {
				return a.val - b.val;
			}); // sort mcap listings numerically by frame
			pTemp.sort(function (a, b) {
				return a.val - b.val;
			}); // sort price listings "
			cTemp.sort(function (a, b) {
				return a.val - b.val;
			}); // sort changeInPercent "
			mActive[frameNum] = jQuery.extend(true, [], mTemp);
			pActive[frameNum] = jQuery.extend(true, [], pTemp);
			cActive[frameNum] = jQuery.extend(true, [], cTemp);
		}
		// finally set changeInPercent rankings back into mactive, pactive, active properties of coListing object array
		for (var frameNum = 0; frameNum < numFrames; frameNum++) {
			for (var ranking = 0; ranking < mActive[frameNum].length; ranking++) {
				if (coListings[mActive[frameNum][ranking].ind].mactive)
					coListings[mActive[frameNum][ranking].ind].mactive = mActive[frameNum].length - ranking;
				if (coListings[pActive[frameNum][ranking].ind].pactive)
					coListings[pActive[frameNum][ranking].ind].pactive = mActive[frameNum].length - ranking;
				if (coListings[cActive[frameNum][ranking].ind].cactive)
					coListings[pActive[frameNum][ranking].ind].pactive = mActive[frameNum].length - ranking;
			}
		}

		mScale = (1.2 + myScale) / maxm; // setmscale / newmscale[1];
		pScale = (1.2 + myScale) / maxp; // newscale[1];
		console.log(" sorted lists for " + mActive.length + " frames with " + mActive[0].length + " companies per frame, maxm = " + maxm);
		console.log(" mscale : " + mScale + ", pscale : " + pScale);
		updateCheck = 1;
		myGeom = 0;
		thisFrame = 0;

	}

	function jPurge(d) { // can be used to force memory cleanup in javascript
		var a = d.attributes, i, l, n;
		if (a) {
			for (i = a.length - 1; i >= 0; i -= 1) {
				n = a[i].name;
				if (typeof d[n] === 'function') {
					d[n] = null;
				}
			}
		}
		a = d.childNodes;
		if (a) {
			l = a.length;
			for (i = 0; i < l; i += 1) {
				jPurge(d.childNodes[i]);
			}
		}
	}

	addDataSet = function addDataSet(dataSetNum) {
//    console.log("addDataSet called for frame: " + dataSetNum);
		var infoPanel = document.getElementById("infoPanel1");
		addData({}, {format: 'mp', name: 'mp', animated: true}, thisFrame);
		var percentLoaded = Math.round(100 * dataSetNum / (numFrames * numCats));
		infoPanel.innerHTML = "<font color=green>loading : " + percentLoaded + "%</font>";
		thisFrame += 1;
		if (thisFrame == numFrames * numCats) {
			animate();  // this starts the globe animation once all data frames have been loaded / sorted
		}
	}

	colorHex = function colorHex(color) {
		return toHex(Math.floor(color.r * 256)) + toHex(Math.floor(color.g * 256)) + toHex(Math.floor(color.b * 256));
	}

	toHex = function toHex(N) {
		if (N == null)
			return "00";
		N = parseInt(N);
		if (N == 0 || isNaN(N))
			return "00";
		N = Math.max(0, N);
		N = Math.min(N, 255);
		N = Math.round(N);
		return "0123456789ABCDEF".charAt((N - N % 16) / 16) + "0123456789ABCDEF".charAt(N % 16);
	}

	function onMouseDown(event) {
		event.preventDefault(); // default in this case could be a selection of the limits / list textareas
		event.stopPropagation();

		container.addEventListener('mouseup', onMouseUp, false);
		container.addEventListener('mouseout', onMouseOut, false);

		event = event || window.event;
		if (!event.which && event.button !== undefined) {
			event.which = (event.button & 1 ? 1 : (event.button & 2 ? 3 : (event.button & 4 ? 2 : 0)));
		}
//    switch (e.which) {
//      case 1: alert('left'); break;
//      case 2: alert('middle'); break;
//      case 3: alert('right'); break;
//    }
		if (event.which == 1) {
			mouseDown = 1;
		}
		if (event.which == 3) {
			mouseRightDown = 1;
		}
		mouseOnDown.x = -event.clientX;
		mouseOnDown.y = event.clientY;
		container.style.cursor = 'move';
//    console.log("innerWidth : " + innerWidth + ", " + mouse.x);
		return false;
	}

	function onMouseMove(event) {
		event.preventDefault();
		mouse.x = -event.clientX;
		mouse.y = event.clientY;
		myMouse.x = (event.clientX / window.innerWidth) * 2 - 1;
		myMouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

		if (mouseDown) {
			mouseRotationX += (mouse.x - mouseOnDown.x) * 0.1;
			mouseRotationY += (mouseOnDown.y - mouse.y) * 0.1;
			mouseOnDown.x = mouse.x; // dampen movement
			mouseOnDown.y = mouse.y;
		}
		if (mouseRightDown) {
			dollyDelta += (mouseOnDown.x - mouse.x) * camera.position.length() / 4500;
			pedestalDelta += (mouse.y - mouseOnDown.y) * camera.position.length() / 4500;
			mouseOnDown.x = mouse.x; // dampen movement
			mouseOnDown.y = mouse.y;
		}

		// COLLISION DETECTION with flags/text/stubs symbols here
		camera.updateProjectionMatrix();
		var vector3 = new THREE.Vector3(myMouse.x, myMouse.y, 0.5);
		vector3.unproject(camera);
		raycaster.setFromCamera(mouse, camera);
		raycaster.set(camera.position, vector3.sub(camera.position).normalize());
		var intersects = raycaster.intersectObjects(objects);
		var intersectionFound = 0;
		var stubTime = 0;
		if (intersects.length > 0) {
			c = intersects[0].object;
			if (c !== lastIntersect) { // prevent multiple ajax calls for a single listing repetitively
				for (var i = 0; i < myFlags[lastTime].length; i++) { // loop through active flags, check for collision
					if (myFlags[lastTime][i].mesh.position.x === c.position.x) {
						if (myFlags[lastTime][i].mesh.position.y === c.position.y) {
							if (myFlags[lastTime][i].mesh.position.z === c.position.z) {
								var colorstr, colorstr1 = "";
								thisCoInd = myFlags[lastTime][i].ind;
								var coListing = coListings[thisCoInd];
								var frameNum, thisCo = "./co/" + coListing.symbol + ".co";
								$.ajax({dataType: "json", url: thisCo, mimeType: "application/json",
									success: function (data) {
										thisName = data[0][0];
										thisAddr = data[0][1];
										if (lastTime > numFrames) {
											frameNum = lastTime - numFrames - 1;
										} else {
											frameNum = lastTime - 1;
										}
										var thisChange = coListing.ChangeFrames[frameNum];
										colorstr = "#" + colorHex(colorFn(parseFloat(thisChange)));
										if (thisChange > 0) {
											colorstr1 = "+";
										} // formatting for output display
										infoPanel.innerHTML = "<font color=white><b>" + coListing.symbol + ": </font><font color='" + colorstr + "'>" + thisName + "</b></font><br />Price: </font><font color='" + colorstr + "'><b>$" + coListing.priceFrames[frameNum] + "</b> (" + colorstr1 + thisChange + "%)" + "</font>" + "<br />Market Cap: </font><font color='" + colorstr + "'><b>$" + Math.floor(1 * coListing.mcapFrames[frameNum]) / 1000 + " B</b><br /></font><font color=white>" + thisAddr + "</font>";
									}
								});
								intersectionFound = 1;
								break;
							}
						}
					}
				}
				if (!intersectionFound && (stubsQ === 1)) { // check for intersections with the stubs, if needed
					for (var i = 0; i < myFlagStubs[stubTime].length; i++) { // loop through stubs, check for collision (mcap/price data stubs only have frame 0)
						if (myFlagStubs[stubTime][i].mesh.position.x === c.position.x) {
							if (myFlagStubs[stubTime][i].mesh.position.y === c.position.y) {
								if (myFlagStubs[stubTime][i].mesh.position.z === c.position.z) {
									var colorstr, colorstr1 = "";
									thisCoInd = myFlagStubs[stubTime][i].ind;
									var coListing = coListings[thisCoInd];
									var frameNum, thisCo = "./co/" + coListing.symbol + ".co";
									$.ajax({dataType: "json", url: thisCo, mimeType: "application/json",
										success: function (data) {
											thisName = data[0][0];
											thisAddr = data[0][1];
											if (lastTime > numFrames) {
												frameNum = lastTime - numFrames - 1;
											} else {
												frameNum = lastTime - 1;
											}
											var thisChange = coListing.ChangeFrames[frameNum];
											colorstr = "#" + colorHex(colorFn(parseFloat(thisChange)));
											if (thisChange > 0) {
												colorstr1 = "+";
											} // formatting for output display
											infoPanel.innerHTML = "<font color=white><b>" + coListing.symbol + ": </font><font color='" + colorstr + "'>" + thisName + "</b></font><br />Price: </font><font color='" + colorstr + "'><b>$" + coListing.priceFrames[frameNum] + "</b> (" + colorstr1 + thisChange + "%)" + "</font>" + "<br />Market Cap: </font><font color='" + colorstr + "'><b>$" + Math.floor(1 * coListing.mcapFrames[frameNum]) / 1000 + " B</b><br /></font><font color=white>" + thisAddr + "</font>";
										}
									});
									break;
								}
							}
						}
					}
				}
				lastIntersect = c;
			}
		}
	}

	function disableGameControls() {
		gameControlsEnabled = 0
	}

	function enableGameControls() {
		gameControlsEnabled = 1
	}


	function onKeyDown(event) {
		//console.log("gameControlsEnabled : " + gameControlsEnabled)
		if (gameControlsEnabled) {
			switch (event.keyCode) {
				// ZOOM IN
				case 87: // "W"
					zoom(24);
					event.preventDefault();
					break;
					// ZOOM OUT
				case 83: // "S"
					zoom(-24);
					event.preventDefault();
					break;
					// truck / dolly camera LEFT
				case 65: // "A"
					dolly(5);
					event.preventDefault();
					break;
					// truck / dolly camera RIGHT
				case 68: // "D"
					dolly(-5);
					event.preventDefault();
					break;
					// pedestal camera DOWN
				case 81: // "Q"
					pedestal(-5);
					event.preventDefault();
					break;
					// pedestal camera UP
				case 69: // "E"
					pedestal(5);
					event.preventDefault();
					break;
					// Rotate scene / globe longitudinally (-)
				case 71: // "G"
					globeRotate(1, -0.005);
					event.preventDefault();
					break;
					// Rotate scene / globe longitudinally (+)
				case 84: // "T"
					globeRotate(1, 0.005);
					event.preventDefault();
					break;
					// Rotate scene / globe latitudinally (-)
				case 70: // "F"
					globeRotate(2, -0.005);
					event.preventDefault();
					break;
					// Rotate scene / globe latitudinally (+)
				case 72: // "H"
					globeRotate(2, 0.005);
					event.preventDefault();
					break;
					// Rotate scene / globe Meridially (-)
				case 82: // "R"
					globeRotate(3, -0.005);
					event.preventDefault();
					break;
					// Rotate scene / globe Meridially (+)
				case 89: // "Y"
					globeRotate(3, 0.005);
					event.preventDefault();
					break;
					// TILT CAMERA UP
				case 73: // "I"
				case 38: // up arrow
					tilt(0.0033);
					event.preventDefault();
					break;
					// TILT CAMERA DOWN
				case 75: // "K"
				case 40: // down arrow
					tilt(-0.0033);
					event.preventDefault();
					break;
					// PAN CAMERA LEFT
				case 74: // "J"
				case 37: // left arrow
					pan(0.0033);
					event.preventDefault();
					break;
					// PAN CAMERA RIGHT
				case 76: // "L"
				case 39: // right arrow
					pan(-0.0033);
					event.preventDefault();
					break;
					// AXIAL CAMERA ROTATION COUNTERCLOCKWISE
				case 85: // "U"
					axialRotate(0.006);
					event.preventDefault();
					break;
					// AXIAL CAMERA ROTATION CLOCKWISE
				case 79: // "O"
					axialRotate(-0.006);
					event.preventDefault();
					break;
			}
		}
	}

	function onWindowResize(event) {
		camera.aspect = window.innerWidth / window.innerHeight;
		camera.updateProjectionMatrix();
		renderer.setSize(window.innerWidth, window.innerHeight);
	}

	function zoom(delta) {  // this zoom moves the camera straight forward on it's line of sight
		zoomDelta += delta * camera.position.length() / 1200;
	}

	function initialZoom() { // set up position of the globe to start
		globeRotate(2, 0.333); // spin the globe around to show the US side
		zoom(225);
		tilt(0.004); // tilt the camera up a bit
		//pan(-0.0015); // pan the camera right a little bit
	}

	function camReset() {
		camera.position.set(0, 0, 9300);
		camera.rotation.set(0, 0, 0);
		scene.rotation.set(0, 0, 0);
		console.log("CamRotation: " + JSON.stringify(camera.rotation) + ", CamPosition: " + JSON.stringify(camera.position));
		initialZoom();
	}

	function dolly(delta) {
		// camera TRUCK/DOLLY positional movement (independant of any target)
		dollyDelta += delta * camera.position.length() / 1200;
	}

	function pedestal(delta) {
		// camera PEDESTAL positional movement (independant of any target)
		pedestalDelta += delta * camera.position.length() / 1200;
	}

	function tilt(delta) {
		tiltDelta += delta;
	}

	function pan(delta) {
		panDelta += delta;
	}

	function axialRotate(delta) {
		axialCamRotationDelta += delta;
	}

	function animate() {
		requestAnimationFrame(animate);
		render();
	}

	function jAdd(x, y) {
		for (var i in x) {
			y[i] += x[i];
		}
	}

	function globeRotate(direction, delta) {
		// globe and scene rotation including scene.add()'ed sub-geometries
		// NOT camera pan/tilt rotation
		// NOT camera dolly/pedestal positional movement
		// NOT revolution about any fixed target point
		switch (direction) {
			case 1:
				globeLongitudeDelta += delta;
				break;
			case 2:
				globeLatitudeDelta += delta;
				break;
			case 3:
				globeMeridianDelta += delta;
				break;
			default:
				console.log("globeRotation error: invalid direction (1-3) specified: " + direction);
		}
	}

	function onMouseUp(event) {
		event = event || window.event;
		if (!event.which && event.button !== undefined) {
			event.which = (event.button & 1 ? 1 : (event.button & 2 ? 3 : (event.button & 4 ? 2 : 0)));
		}
		if (event.which == 1) {
			mouseDown = 0;
		}
		if (event.which == 3) {
			mouseRightDown = 0;
		}
		if (!mouseDown && !mouseRightDown) {
			container.removeEventListener('mouseup', onMouseUp, false);
			container.removeEventListener('mouseout', onMouseOut, false);
			container.style.cursor = 'auto';
		}
	}

	function onMouseOut(event) {
		mouseDown = 0;
		mouseRightDown = 0;
		container.removeEventListener('mouseup', onMouseUp, false);
		container.removeEventListener('mouseout', onMouseOut, false);
	}

	function onMouseWheel(event) { // special mouse scroll ZOOM TOWARDS MOUSE POSITION
		event.preventDefault();
		var delta = 0;
		if (event.wheelDelta) { // WebKit / Opera / Explorer 9
			delta = event.wheelDelta / 8;
		} else if (event.detail) { // Firefox
			delta = -event.detail * 2;
		}
		if (overRenderer) {
			mouseZoomDelta += delta * camera.position.length() / 1200;
		}
		return false;
	}

	function cameraLookDir(camera) {
		var vector = new THREE.Vector3(0, 0, -1);
		vector.applyEuler(camera.rotation, camera.rotation.order);
		//vector.normalize(); // needed ?
		return vector;
	}
	;

	function cameraUpDir(camera) {
		var vector = new THREE.Vector3(0, 1, 0);
		vector.applyEuler(camera.rotation, camera.rotation.order);
		return vector;
	}
	;

	function cameraSideDir(camera) {
		var vector = new THREE.Vector3(-1, 0, 0);
		vector.applyEuler(camera.rotation, camera.rotation.order);
		return vector;
	}
	;

	function render() {

		if (axialCamRotationDelta) {
			// damped camera rotation on the axis of the camera's line of sight, clockwise or counter-clockwise
			camera.rotateOnAxis(theZAxis, axialCamRotationDelta);
			axialCamRotationDelta = Math.abs(axialCamRotationDelta * 0.9) > 0.002 ? axialCamRotationDelta * 0.9 : 0;
		}
		if (panDelta) {
			// damped camera rotation on the axis of the camera's "up" direction, clockwise or counter-clockwise
			// cinematic pan right or left
			camera.rotateOnAxis(theYAxis, panDelta);
			panDelta = Math.abs(panDelta * 0.9) > 0.002 ? panDelta * 0.9 : 0;
		}
		if (tiltDelta) {
			// damped camera rotation on the axis of the camera's sideways direction
			// cinematic tilt up or down
			camera.rotateOnAxis(theXAxis, tiltDelta);
			tiltDelta = Math.abs(tiltDelta * 0.9) > 0.002 ? tiltDelta * 0.9 : 0;
		}
		if (zoomDelta) {
			// damped camera movement along the camera's current line of sight
			// cinematic zoom in or out
			camera.position.addVectors(camera.position, cameraLookDir(camera).multiplyScalar(zoomDelta / 2));
			zoomDelta = Math.abs(zoomDelta * .9) > 4.2 ? zoomDelta * .9 : 0;
		}
		if (mouseZoomDelta) {
			var vector = new THREE.Vector3(myMouse.x, myMouse.y, 1);
			vector.unproject(camera);
			vector.sub(camera.position);
			camera.position.addVectors(camera.position, vector.setLength(mouseZoomDelta));
			mouseZoomDelta = Math.abs(mouseZoomDelta * .9) > 0.1 ? mouseZoomDelta * .9 : 0;
		}

		if (dollyDelta) {
			// damped camera movement along camera's current sideways direction
			// truck/dolly/tracking positional cam movement
			var thisSideWays = cameraSideDir(camera);
			camera.position.addVectors(camera.position, thisSideWays.multiplyScalar(dollyDelta));
			dollyDelta = Math.abs(dollyDelta * .9) > 0.6 ? dollyDelta * .9 : 0;
		}
		if (pedestalDelta) {
			// damped camera movement along camera's current UP direction
			// pedestal positional cam movement
			var thisUpWays = cameraUpDir(camera);
			camera.position.addVectors(camera.position, thisUpWays.multiplyScalar(pedestalDelta));
			pedestalDelta = Math.abs(pedestalDelta * .9) > 0.6 ? pedestalDelta * .9 : 0;
		}
		if (globeLongitudeDelta) {
			scene.rotateOnAxis(theXAxis, globeLongitudeDelta);
			globeLongitudeDelta = Math.abs(globeLongitudeDelta * .9) > 0.001 ? globeLongitudeDelta * .9 : 0;
		}
		if (globeLatitudeDelta) {
			scene.rotateOnAxis(theYAxis, globeLatitudeDelta);
			globeLatitudeDelta = Math.abs(globeLatitudeDelta * .9) > 0.001 ? globeLatitudeDelta * .9 : 0;
		}
		if (globeMeridianDelta) {
			scene.rotateOnAxis(theZAxis, globeMeridianDelta);
			globeMeridianDelta = Math.abs(globeMeridianDelta * .9) > 0.001 ? globeMeridianDelta * .9 : 0;
		}

		if (mouseRotationX || mouseRotationY) {
			var thisRotationVector = camera.position.clone();
			if (mouseRotationX) {
				camera.rotateOnAxis(theYAxis, mouseRotationX / 128);
				thisRotationVector.applyAxisAngle(cameraUpDir(camera), mouseRotationX / 128);
				mouseRotationX = Math.abs(mouseRotationX * .9) > 0.1 ? mouseRotationX * .9 : 0;
			}
			if (mouseRotationY) {
				camera.rotateOnAxis(theXAxis, mouseRotationY / 128);
				thisRotationVector.applyAxisAngle(cameraSideDir(camera), -1 * mouseRotationY / 128);
				mouseRotationY = Math.abs(mouseRotationY * .9) > 0.1 ? mouseRotationY * .9 : 0;
			}
			// orbit the camera around scene origin, matching the camera rotation
			camera.position.set(thisRotationVector.x, thisRotationVector.y, thisRotationVector.z);
		}

		// slowly orbit the clouds around the Earth
		clouds.rotation.y += 0.00005;
		renderer.clear();
		renderer.render(scene, camera);
		//renderer.render(sceneAtmosphere, camera);
	}
	init();
	this.animate = animate;
	this.__defineGetter__('time', function () {
		return this._time || 0;
	});

	this.__defineGetter__('time', function () {
		return this._time || 0;
	});

	this.__defineSetter__('time', function (t) {

		var l = numFrames * numCats - 1;
		var scaledt = t * l + 1;
		var index = Math.floor(scaledt);
		this._time = t;
//    totalWarns = totalWarns +1;
//    if(totalWarns < 100) {
//      console.log("setting time to: " + t);
//      console.log("geoms.length: " + geoms.length + ", index : " + index);
//    }
		updateFlags(index);
		updateLists(index);

//    console.log("setting time to " + t + ", frame " + index);
		if (thisCoInd >= 0) { // this allows to change timeframes while watching a company info-box listing
			var coListing = coListings[thisCoInd];
			if (index > numFrames) {
				frameNum = index - numFrames - 1;
			} else {
				frameNum = index - 1;
			}
			var thisChange = coListing.ChangeFrames[frameNum];
			colorstr = "#" + colorHex(colorFn(parseFloat(thisChange)));
			var colorstr1 = "";
			if (thisChange > 0) {
				colorstr1 = "+";
			} // formatting for output display
			infoPanel.innerHTML = "<font color=white><b>" + coListing.symbol + ": </font><font color='" + colorstr + "'>" + thisName + "</b></font><br />Price: </font><font color='" + colorstr + "'><b>$" + coListing.priceFrames[frameNum] + "</b> (" + colorstr1 + thisChange + "%)" + "</font>" + "<br />Market Cap: </font><font color='" + colorstr + "'><b>$" + Math.floor(1 * coListing.mcapFrames[frameNum]) / 1000 + " B</b><br /></font><font color=white>" + thisAddr + "</font>";
		}
//    updateText(index);
	});

	// this block enables onMouseover of the win/lose list to set company data into the "info-box"
	var ctxm = document.getElementById('winners');
	var offSetY = $(ctxm).parent().offset().top;
	var lastListing = -1;
	ctxm.addEventListener('mousemove', function (evt) {
		var thisListing = Math.floor((evt.clientY - offSetY) / 15);
		if ((thisListing !== lastListing) && (thisListing < winListings.length)) {
			var frameNum, thisCo = "./co/" + winListings[thisListing].symbol + ".co";
			var coInd = winListings[thisListing].ind;
			var coListing = coListings[coInd];
			thisCoInd = coInd;
			$.ajax({dataType: "json", url: thisCo, mimeType: "application/json", success: function (data) {
					thisName = data[0][0];
					thisAddr = data[0][1];
					if (lastTime > numFrames) {
						frameNum = lastTime - numFrames - 1;
					} else {
						frameNum = lastTime - 1;
					}
					var thisChange = coListing.ChangeFrames[frameNum];
					colorstr = "#" + colorHex(colorFn(parseFloat(thisChange)));
					var colorstr1 = "";
					if (thisChange > 0) {
						colorstr1 = "+";
					} // formatting for output display
					infoPanel.innerHTML = "<font color=white><b>" + coListing.symbol + ": </font><font color='" + colorstr + "'>" + thisName + "</b></font><br />Price: </font><font color='" + colorstr + "'><b>$" + coListing.priceFrames[frameNum] + "</b> (" + colorstr1 + thisChange + "%)" + "</font>" + "<br />Market Cap: </font><font color='" + colorstr + "'><b>$" + Math.floor(1 * coListing.mcapFrames[frameNum]) / 1000 + " B</b><br /></font><font color=white>" + thisAddr + "</font>";
				}
			});
		}
		thisListing = lastListing; // prevent multiple calls to the same listing repetitively
	}, false);

	this.addData = addData;
	this.addDataSet = addDataSet;
	this.addText = addText;
	this.readIndex = readIndex;
	this.updatePoints = updatePoints;
	this.tStubs = tStubs;
	this.renderer = renderer;
	this.scene = scene;
	this.setNumFrames = setNumFrames;
	this.initialZoom = initialZoom;
	this.camReset = camReset;
	this.enableGameControls = enableGameControls;
	this.disableGameControls = disableGameControls;
	return this;
};