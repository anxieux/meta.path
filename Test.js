function test() {
    var canvas=document.getElementById("myCanvas");
    var c=canvas.getContext("2d");
    var path3 = new meta.paths.Path([[10, 10], {ctrls: [[40, 30], [30, 35]]},
                                     [60, 70], {tension: [3/4, 3/4], dirs: [[1, 0], [1, 1]]},
                                     [170, 115]]);
    c.beginPath();
    path3.drawIn(c);
    c.lineWidth = 1;
    c.strokeStyle = "red"; 
    c.stroke();
    c.beginPath();
    path3.drawControlsIn(c);
    c.lineWidth = 1;
    c.strokeStyle = "black"; 
    c.stroke();
}