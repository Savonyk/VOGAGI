'use strict';

let gl;                         // The webgl context.
let surface;                    // A surface model
let light;
let shProgram;                  // A shader program
let spaceball;                  // A SimpleRotator object that lets the user rotate the view by mouse.
let lightPositionEl;
let lightPos = [0,0,0];
let height = 1.5;
let step = 20;
let radius = 10;
let p = 1;
let uStep = 360 / (step + 1); 
let vStep = 2 * height / (step + 1);

function GetRadiansFromDegree(angle) {
    return angle * Math.PI / 180;
}

function GetCirclePoint(angle)
{
    angle = GetRadiansFromDegree(angle);
    let x = radius * Math.cos(angle);
    let y = 0;
    let z = radius * Math.sin(angle);

    return [x,y,z];
}


// Constructor
function Model(name) {
    this.name = name;
    this.iVertexBuffer = gl.createBuffer();
    this.iTexCoordBuffer = gl.createBuffer();
    this.count = 0;

    this.BufferData = function(vertices, texCoord) {

        gl.bindBuffer(gl.ARRAY_BUFFER, this.iVertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STREAM_DRAW);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.iTexCoordBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(texCoord), gl.STREAM_DRAW);

        this.count = vertices.length/3;
    }

    this.Draw = function(mode) {

        gl.bindBuffer(gl.ARRAY_BUFFER, this.iVertexBuffer);
        gl.vertexAttribPointer(shProgram.iAttribVertex, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(shProgram.iAttribVertex);
   
        gl.vertexAttribPointer(shProgram.iNormal, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(shProgram.iNormal); 
        
        LoadTexture();

        gl.drawArrays(mode, 0, this.count);


    }
}


// Constructor
function ShaderProgram(name, program) {

    this.name = name;
    this.prog = program;

    // Location of the attribute variable in the shader program.
    this.iAttribVertex = -1;
    // Location of the uniform specifying a color for the primitive.
    this.iColor = -1;
    // Location of the uniform matrix representing the combined transformation.
    this.iModelViewProjectionMatrix = -1;

    // Normals
    this.iNormal = -1;
    this.iNormalMatrix = -1;

    // Ambient, diffuse, specular
    this.iAmbientColor = -1;
    this.iDiffuseColor = -1;
    this.iSpecularColor = -1;
    this.iAmbientCoefficient = -1;
    this.iDiffuseCoefficient = -1;
    this.iSpecularCoefficient = -1;
    this.iTMU = -1;
    this.iTexCoord = -1;
    // Shininess
    this.iShininess = -1;

    // Light position
    this.iLightPos = -1;

    this.Use = function() {
        gl.useProgram(this.prog);
    }
}


/* Draws a colored cube, along with a set of coordinate axes.
 * (Note that the use of the above drawPrimitive function is not an efficient
 * way to draw with WebGL.  Here, the geometry is so simple that it doesn't matter.)
 */
function draw() { 
    gl.clearColor(1,1,1,1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    
    /* Set the values of the projection transformation */
    let orthographic = m4.orthographic(-2, 2, -2,2, 8, 12); 
    
    /* Get the view matrix from the SimpleRotator object.*/
    let modelView = spaceball.getViewMatrix();

    let rotateToPointZero = m4.axisRotation([0.707,0.707,0], 0.7);
    let translateToPointZero = m4.translation(0,0,-10);

    let matAccum0 = m4.multiply(rotateToPointZero, modelView );
    let matAccum1 = m4.multiply(translateToPointZero, matAccum0 );
        
    const modelviewInv = m4.inverse(matAccum1, new Float32Array(16));
    const normalMatrix = m4.transpose(modelviewInv, new Float32Array(16));  


    /* Multiply the projection matrix times the modelview matrix to give the
       combined transformation matrix, and send that to the shader program. */
    let modelViewProjection = m4.multiply(orthographic, matAccum1 );

    gl.uniformMatrix4fv(shProgram.iModelViewProjectionMatrix, false, modelViewProjection );
    
    gl.uniformMatrix4fv(shProgram.iNormalMatrix, false, normalMatrix);

    let angle = Array.from(lightPositionEl.getElementsByTagName('input')).map(el => +el.value)[0];

    lightPos = GetCirclePoint(angle);
    gl.uniform3fv(shProgram.iLightPos, lightPos);

    gl.uniform1f(shProgram.iShininess, 80.0);
    gl.uniform1f(shProgram.iAmbientCoefficient, 1);
    gl.uniform1f(shProgram.iDiffuseCoefficient, 1);
    gl.uniform1f(shProgram.iSpecularCoefficient, 1);

    gl.uniform3fv(shProgram.iAmbientColor, [0.2, 0.1, 0.4]);
    gl.uniform3fv(shProgram.iDiffuseColor, [0, 0.8, 0.8]);
    gl.uniform3fv(shProgram.iSpecularColor, [1.0, 1.0, 1.0]);

    /* Draw the six faces of a cube, with different colors. */
    gl.uniform4fv(shProgram.iColor, [0,0,0.8,1] );
    surface.Draw(gl.TRIANGLE_STRIP);
    light.Draw(gl.LINES);
}

function GetCurrentZPosition(h){
    return Math.pow(Math.abs(h) - height, 2) / (2*p);
}

// surface - parabolic humming-top
// x = ((|z| - h)^2 / 2*p)) * cosB
// y = ((|z| - h)^2 / 2*p)) * sinB
// z = z
function CreateParabolicData(startU, endU, startV, endV, stepU, stepV)
{
    let list = [];

    for (let u = startU; u <= endU; u += stepU) 
    {
        for(let v = startV; v <= endV; v += stepV)
        {
            let currentAngle = GetRadiansFromDegree(u);
            let currentTemp = GetCurrentZPosition(v);
            let nextAngle = GetRadiansFromDegree(u + stepU);

            list.push(currentTemp * Math.cos(currentAngle), v, currentTemp * Math.sin(currentAngle));
            list.push(currentTemp * Math.cos(nextAngle), v, currentTemp * Math.sin(nextAngle));
        }
    }

    return list;
}

function CreateSurfaceData()
{
    uStep = 360 / (step + 1); 
    vStep = 2 * height / (step + 1);
    let v = CreateParabolicData(0, 360, -height, height, uStep, vStep);
    console.log(v.length);
    return CreateParabolicData(0, 360, -height, height, uStep, vStep);
}

function CreateTextureCoordinates()
{
    let textCoord = [];

    uStep = 360 / (step + 1); 
    vStep = 2 * height / (step + 1);

    for (let u = 0; u <= 360; u += uStep) 
    {
        for(let v = -height; v <= height; v += vStep)
        {
            textCoord.push(GetRadiansFromDegree(u) / (2 * Math.PI), v / (2*height));
            textCoord.push(GetRadiansFromDegree(u + uStep) / (2 * Math.PI), (v + vStep) / (2 * height));
        }
    }

    console.log(" " + textCoord.length);

    return textCoord;
}

function CreateLightData()
{
    let vertexList = [];

    vertexList.push(lightPos[0], lightPos[1],lightPos[2]);
    vertexList.push(0,0,0);

    return vertexList;
}


/* Initialize the WebGL context. Called from init() */
function initGL() {
    let prog = createProgram( gl, vertexShaderSource, fragmentShaderSource );

    shProgram = new ShaderProgram('Basic', prog);
    shProgram.Use();

    shProgram.iAttribVertex              = gl.getAttribLocation(prog, "vertex");
    shProgram.iModelViewProjectionMatrix = gl.getUniformLocation(prog, "ModelViewProjectionMatrix");
    shProgram.iColor                     = gl.getUniformLocation(prog, "color");

    shProgram.iNormal                    = gl.getAttribLocation(prog, 'normal');
    shProgram.iNormalMatrix              = gl.getUniformLocation(prog, 'normalMat');

    shProgram.iAmbientColor              = gl.getUniformLocation(prog, 'ambientColor');
    shProgram.iDiffuseColor              = gl.getUniformLocation(prog, 'diffuseColor');
    shProgram.iSpecularColor             = gl.getUniformLocation(prog, 'specularColor');

    shProgram.iShininess                 = gl.getUniformLocation(prog, 'shininess');

    shProgram.iLightPos                  = gl.getUniformLocation(prog, 'lightPosition');
    shProgram.iSpecularCoefficient       = gl.getUniformLocation(prog, 'specularCoefficient');
    shProgram.iAmbientCoefficient        = gl.getUniformLocation(prog, 'ambientCoefficient');
    shProgram.iDiffuseCoefficient        = gl.getUniformLocation(prog, 'diffuseCoefficient');
    shProgram.iTMU                       = gl.getUniformLocation(prog, 'sampler'); 
    shProgram.iTexCoord                  = gl.getAttribLocation(prog, 'texCoord');

    surface = new Model('Surface');
    surface.BufferData(CreateSurfaceData(), CreateTextureCoordinates());
    let s = CreateTextureCoordinates();
    light = new Model('light');
    light.BufferData(CreateLightData());
    gl.enable(gl.DEPTH_TEST);
}


/* Creates a program for use in the WebGL context gl, and returns the
 * identifier for that program.  If an error occurs while compiling or
 * linking the program, an exception of type Error is thrown.  The error
 * string contains the compilation or linking error.  If no error occurs,
 * the program identifier is the return value of the function.
 * The second and third parameters are strings that contain the
 * source code for the vertex shader and for the fragment shader.
 */
function createProgram(gl, vShader, fShader) {
    let vsh = gl.createShader( gl.VERTEX_SHADER );
    gl.shaderSource(vsh,vShader);
    gl.compileShader(vsh);
    if ( ! gl.getShaderParameter(vsh, gl.COMPILE_STATUS) ) {
        throw new Error("Error in vertex shader:  " + gl.getShaderInfoLog(vsh));
     }
    let fsh = gl.createShader( gl.FRAGMENT_SHADER );
    gl.shaderSource(fsh, fShader);
    gl.compileShader(fsh);
    if ( ! gl.getShaderParameter(fsh, gl.COMPILE_STATUS) ) {
       throw new Error("Error in fragment shader:  " + gl.getShaderInfoLog(fsh));
    }
    let prog = gl.createProgram();
    gl.attachShader(prog,vsh);
    gl.attachShader(prog, fsh);
    gl.linkProgram(prog);
    if ( ! gl.getProgramParameter( prog, gl.LINK_STATUS) ) {
       throw new Error("Link error in program:  " + gl.getProgramInfoLog(prog));
    }
    return prog;
}


/**
 * initialization function that will be called when the page has loaded
 */
function init() {
    lightPositionEl = document.getElementById('lightPostion');
    let canvas;
    try {
        canvas = document.getElementById("webglcanvas");
        gl = canvas.getContext("webgl");
        if ( ! gl ) {
            throw "Browser does not support WebGL";
        }
    }
    catch (e) {
        document.getElementById("canvas-holder").innerHTML =
            "<p>Sorry, could not get a WebGL graphics context.</p>";
        return;
    }
    try {
        initGL();  // initialize the WebGL graphics context
    }
    catch (e) {
        document.getElementById("canvas-holder").innerHTML =
            "<p>Sorry, could not initialize the WebGL graphics context: " + e + "</p>";
        return;
    }

    spaceball = new TrackballRotator(canvas, draw, 0);

    draw();
}

function LoadTexture()
{
    var texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    //gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0,0,255,255]));
    var image = new Image();
    image.crossOrigin = "Anonymous";
    image.src = "https://user-images.githubusercontent.com/12417677/97433592-a9e07800-1915-11eb-8f0b-f4e8cdf8babb.png";
    image.addEventListener('load', () => {
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);

        draw();
    }

    );

}

function Redraw() {
    surface.BufferData(CreateSurfaceData());
    light.BufferData(CreateLightData());
    draw();
}