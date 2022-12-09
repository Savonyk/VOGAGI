'use strict';

let gl;                         // The webgl context.
let surface;                    // A surface model
let shProgram;                  // A shader program
let spaceball;                  // A SimpleRotator object that lets the user rotate the view by mouse.
let height = 1.5;
let width = 360;
let u = 18;
let v = 0.15;
let p = 1;

function GetRadiansFromDegree(angle) {
    return angle * Math.PI / 180;
}

function GetNormal(firstPoint, secondPoint, thirdPoint)
{
    let result = []; 

    let a = m4.subtractVectors(secondPoint,firstPoint);
    let b = m4.subtractVectors(thirdPoint,firstPoint);

    result = m4.cross(a, b);

    return result;
}

function CreateTriangles(vertices)
{
    let triangles = [];

    for (let i = 0; i < vertices.length; i += 3) {

        let first = [vertices[i], vertices[i + 1], vertices[i + 2]];
        let second = [vertices[i + 3], vertices[i + 4], vertices[i + 5]];
        let third = [vertices[i + 6], vertices[i + 7], vertices[i + 8]];

        triangles.push(new Triangle(first, second, third, m4.normalize(GetNormal(first, second, third))));
    }
    return triangles;
}

function UpdateNormalsInTriangles(triangles)
{
    for(let i = 0; i < triangles.length - 1;i++)
    {
        for(let j = i + 1; j < triangles.length; j++)
        {
            if(triangles[i].ContainsVertex(triangles[j]))
            {
                let normal = m4.addVectors(triangles[i].normal, triangles[j].normal);
                triangles[i].normal = normal;
            }
            
        }
    }
}

function IsEqualValue(first, second)
{
    if(first[0] == second[0] || first[1] == second[1] || first[2] == second[2])     return true;

    return false;
}

function Triangle(first, second, third, normal)
{
    this.firstPoint = first;
    this.secondPoint = second;
    this.thirdPoint = third;
    this.normal = normal;
    this.vertexs = [];

    this.ContainsVertex = function(triangle)
    {
        if(this == triangle) return false;

        if(IsEqualValue(this.firstPoint, triangle.firstPoint) || IsEqualValue(this.secondPoint, triangle.secondPoint)
          || IsEqualValue(this.thirdPoint, triangle.thirdPoint)) return true;

        return false;
    }
}

// Constructor
function Model(name) {
    this.name = name;
    this.iVertexBuffer = gl.createBuffer();
    this.iNormalBuffer = gl.createBuffer();
    this.count = 0;

    this.BufferData = function(vertices, normal) { 

        gl.bindBuffer(gl.ARRAY_BUFFER, this.iVertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STREAM_DRAW);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.iNormalBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(normal), gl.STREAM_DRAW);

        this.count = vertices.length/3;
    }

    this.Draw = function() {

        gl.bindBuffer(gl.ARRAY_BUFFER, this.iVertexBuffer);
        gl.vertexAttribPointer(shProgram.iAttribVertex, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(shProgram.iAttribVertex);

        gl.drawArrays(gl.TRIANGLE_STRIP, 0, this.count);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.iNormalBuffer);
        gl.vertexAttribPointer(shProgram.iAttribNormal, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(shProgram.iAttribNormal);
    }
}

// Constructor
function ShaderProgram(name, program) { 

    this.name = name;
    this.prog = program;

    // Location of the attribute variable in the shader program.
    this.iAttribVertex = -1;
    // Location of the attribute variable in the shader program.
    this.iAttribNormal = -1;
    // Location of the uniform specifying a color for the primitive.
    this.iColor = -1;
    // Location of the uniform matrix representing the combined transformation.
    this.iModelViewProjectionMatrix = -1;

    this.Use = function() {
        gl.useProgram(this.prog);
    }
}


/*Draws a colored cube, along with a set of coordinate axes.
 * (Note that the use of the above drawPrimitive function is not an efficient
 * way to draw with WebGL.  Here, the geometry is so simple that it doesn't matter.)
 */
function draw() { 
    gl.clearColor(0,0,0,1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    
    /* Set the values of the projection transformation */
    let projection = m4.orthographic(-2, 2, -2,2, 8, 12); 
    
    /* Get the view matrix from the SimpleRotator object.*/
    let modelView = spaceball.getViewMatrix();

    let rotateToPointZero = m4.axisRotation([0.707,0.707,0], 0.7);
    let translateToPointZero = m4.translation(0,0,-10);

    let matAccum0 = m4.multiply(rotateToPointZero, modelView );
    let matAccum1 = m4.multiply(translateToPointZero, matAccum0 );
        
    /* Multiply the projection matrix times the modelview matrix to give the
       combined transformation matrix, and send that to the shader program. */
    let modelViewProjection = m4.multiply(projection, matAccum1 );

    gl.uniformMatrix4fv(shProgram.iModelViewProjectionMatrix, false, modelViewProjection );
    
    gl.uniform4fv(shProgram.iColor, [0.3,0,1,1] );

    surface.Draw();
}

function GetCurrentZPosition(h){
    return Math.pow(Math.abs(h) - height, 2) / (2*p);
}  

// surface - parabolic humming-top
// x = ((|z| - h)^2 / 2*p)) * cosB
// y = ((|z| - h)^2 / 2*p)) * sinB
// z = z
function CreateSurfaceData()
{
    let vertexList = [];

    for (let i = 0; i <= 360; i += u) 
    {
        for(let j = -height; j <= height; j += v)
        {
            let currentAngle = GetRadiansFromDegree(i);
            let currentTemp = GetCurrentZPosition(j);
            let nextAngle = GetRadiansFromDegree(i + u);

            vertexList.push(currentTemp * Math.cos(currentAngle), j, currentTemp * Math.sin(currentAngle));
            vertexList.push(currentTemp * Math.cos(nextAngle), j, currentTemp * Math.sin(nextAngle));
        }
    }

    return vertexList;
}

function CreateSurfaceNormals(vertices)
{
    let normalList = [];
    let triangles = CreateTriangles(vertices);

    UpdateNormalsInTriangles(triangles);

    for(let i = 0; i < triangles.length; i++)
    {
        let normal = m4.normalize(triangles[i].normal);
        normalList.push(normal[0], normal[1], normal[2]);
    }

    return normalList;
}


/* Initialize the WebGL context. Called from init() */
function initGL() {
    let prog = createProgram( gl, vertexShaderSource, fragmentShaderSource );

    shProgram = new ShaderProgram('Basic', prog);
    shProgram.Use();

    shProgram.iAttribVertex              = gl.getAttribLocation(prog, "vertex");
    shProgram.iAttribNormal            = gl.getAttribLocation(prog, "normal");
    shProgram.iModelViewProjectionMatrix = gl.getUniformLocation(prog, "ModelViewProjectionMatrix");
    shProgram.iColor                     = gl.getUniformLocation(prog, "color");

    surface = new Model('Surface');
    surface.BufferData(CreateSurfaceData(), CreateSurfaceNormals(CreateSurfaceData()));

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
