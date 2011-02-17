var meta;
meta = {};
meta.paths = {};
// TODO: check namespaces here


/** Better mod: returns result in interval between 0 and b ([0, b] if b>0 and [b, 0] if b<0)
 * @param {Number} x
 * @param {Number} b  Base
 */
Math.mod = function (x, b) {
    return (Math.sign(x) === Math.sign(b)) ? (x % b) : (x % b + b);
};

/**
 * @param {Number} x
 */
Math.sign = function (x) {
    return (x >= 0) ? 1 : -1;
};

(function () {
    var mp = meta.paths;

    var regExpStr = {};
    regExpStr.number = "[-+]?[0-9]*\\.?[0-9]+";
    regExpStr.pair = regExpStr.number + "," + regExpStr.number;
    regExpStr.pairExtended = "(" + regExpStr.number + "),(" + regExpStr.number + ")";
    regExpStr.point = "\\(" + regExpStr.pair + "\\)" + "|cycle";
    regExpStr.pointExtended = "\\(" + regExpStr.pairExtended + "\\)" + "|cycle";
    regExpStr.dir = "\\{(?:curl\\s(" + regExpStr.number + ")|(" + regExpStr.point + ")|(" + regExpStr.pair + "))\\}";
    regExpStr.tension = "tension\\s(" + regExpStr.number + ")(?:\\sand\\s(" + regExpStr.number + "))?";
    regExpStr.ctrls = "controls\\s(" + regExpStr.point + ")(?:\\sand\\s(" + regExpStr.point + "))?";
    // (0: all)(1: curl)(2: dir point)(3: dir pair)(4: tension)(5: tension)(6: ctrl)(7: ctrl)(8: curl)(9: dir point)(10: dir pair)(11: point)
    regExpStr.join = "(?:(?:" + regExpStr.dir + ")?\\.{2}" + "(?:(?:(?:" + regExpStr.tension + ")|(?:" + regExpStr.ctrls + "))\\.{2})?(?:" + regExpStr.dir + ")?)(" + regExpStr.point + ")";


    var regExp = {};
    for(var field in regExpStr) {
        regExp[field] = new RegExp(regExpStr[field]);
    }
    
    function cast(obj, type) {
        if (obj instanceof type) {
            return obj;
        } else {
            try {
                return new type(obj);
            } catch (ex) {
                throw new Error("can't cast " + obj + " to type " + type + "\n" + "with exeption " + ex);
            }
        }
    }
    
    /**
     * PointFacade class (stores ref to src object and trying to find x and y)
     *
     * @class
     * @param {Object} src
     */
    meta.paths.PointFacade = function (src) {
        if (typeof(src) === "string") {
            src = mp.PointFacade.parse(src);
        }
        this.src = src;
    };
    
    /** @returns {Number} Current x-value */
    meta.paths.PointFacade.prototype.x = extractFieldAsFunction.call(this, "x", 0);
    
    /** @returns {Number} Current y-value */
    meta.paths.PointFacade.prototype.y = extractFieldAsFunction.call(this, "y", 1);
    
    /**
     * @param {String} c
     * @param {Number} i
     * @returns {Function}
     */
    function extractFieldAsFunction() {
        var args = arguments;
        return function () {
            for (var j = 0; j < args.length; j++) {
                switch(typeof this.src[args[j]]) {
                case "number":
                    return this.src[args[j]];
                case "object":
                    return this.src[args[j]].valueOf();
                case "function":
                    return this.src[args[j]](); // try to call
                case "string":
                    return parseFloat(this.src[args[j]]);
                }
            }
            throw new Error("nothing like point found");
        };
    }
    
    /** No comments :) */
    meta.paths.PointFacade.prototype.toString = function () {
        return "(" + this.x() + "," + this.y() + ")";    
    };

    meta.paths.PointFacade.parse = function (str) {
        var point = regExp.pairExtended.exec(str);
        return {x: parseFloat(point[1]), y: parseFloat(point[2])};
    };
    
    /**
     * Static (independent) copy of current points state
     * @returns {Object}
     */
    meta.paths.PointFacade.prototype.snapshot = function () {
        return {x: this.x(), y: this.y()};
    };
    
    // Simple operations:
    /**
     * @param {mp.PointFacade} p1
     * @param {mp.PointFacade} p2
     * @returns {mp.PointFacade}
     */
    meta.paths.PointFacade.sum = function (p1, p2) {
        return new mp.PointFacade({x: p1.x() + p2.x(), y: p1.y() + p2.y()});
    };
    
    meta.paths.PointFacade.prototype.modulus = function () {
        return Math.sqrt(this.x() * this.x() + this.y() * this.y());
    };
    
    /** @param {Number} c */
    meta.paths.PointFacade.prototype.scaled = function (c) {
        return new mp.PointFacade({x: c * this.x(), y: c * this.y()});
    };
    
    /**
     * Angle between p1 and p2 (store sin, cos and arg)
     * @class
     * @param {mp.PointFacade} p1
     * @param {mp.PointFacade} p2
     */
    meta.paths.Arg = function (p1, p2) {
        p2 = p2 || new mp.PointFacade({x: 1, y: 0});
        // |p2|^2 * (p1/p2) = p1 * conjugate(p2)  in complex form:
        var quotient = new mp.PointFacade({x: p1.x()*p2.x() + p1.y()*p2.y(), y: p2.x()*p1.y() - p1.x()*p2.y()});
        var modulus = quotient.modulus();
        if (modulus === 0) {
            this.sin = this.cos = this.arg = undefined;
        } else {
            this.cos = quotient.x() / modulus;
            this.sin = quotient.y() / modulus;
            this.arg = Math.sign(quotient.y()) * Math.acos(this.cos);
        }
    };
    
    meta.paths.Arg.prototype.valueOf = function () {
        return this.arg;
    };
    
    
    // ------- Joins -------
    /** Join class.
     * Fields: dirs[pair of (direction[mp.PointFacade] | curl[numder])], {ctrls | tension}
     * @param {Object} j
     */
    meta.paths.Join = function (j) {
        j = j || {};
        
        function ctrls(ctrls) {
            return [new mp.PointFacade(ctrls[0]), new mp.PointFacade(ctrls[1] || ctrls[0])];
        }

        function tension(tension) {
            if (!tension) {
                return [1, 1];
            } else {
                return [tension[0] || 1, tension[1] || tension[0] || 1];
            }
        }

        if (j instanceof Array) {
            this.dirs = [(j[1] ? parseFloat(j[1]) : false) || j[2] || j[3], 
                         (j[8] ? parseFloat(j[8]) : false) || j[9] || j[10]]; 
            if (j[6] !== undefined) {
                this.ctrls = ctrls([j[6], j[7]]);
            } else {
                this.tension = tension([j[4], j[5]]);
            }
        } else if (typeof(j) === "object") {
            this.dirs = j.dirs || [undefined, undefined];
            if (j.ctrls !== undefined) {   // strong join
                this.ctrls = ctrls(j.ctrls);
            } else {                       // soft join
                this.tension = tension(j.tension);
            }
        } else {
            throw new Error(j + " is not a join");
        }

        for (var i = 0; i < 2; i++) {
            // direction can be one of 3 types: curl (number), vector (object, including array) and undefined
            if (typeof(this.dirs[i]) === "object" || typeof(this.dirs[i]) === "string") {
                this.dirs[i] = new mp.PointFacade(this.dirs[i]);
                if (this.dirs[i].modulus() === 0) {
                    this.dirs[i] = undefined; 
                }
            }
        }
    };
    
    // Calculate directions from controls
    meta.paths.Join.prototype.castCtrlsToDirs = function (points) {
        if(!this.isSoft()) {
            for(var i = 0; i < 2; i++) {
                this.dirs[i] = mp.PointFacade.sum(this.ctrls[i], points[i].scaled(-1));
            }
        }
    };
        
    // Share directions between two adjacent joins
    meta.paths.Join.prototype.shareDirs = function (nextJoin) {
        nextJoin.dirs[0] = nextJoin.dirs[0] || this.dirs[1];
        this.dirs[1] = this.dirs[1] || nextJoin.dirs[0];
    };

    meta.paths.Join.prototype.castDirsToCtrls = function (points) {
        if(this.isSoft()) {
            var diff = mp.PointFacade.sum(points[1], points[0].scaled(-1));
            var arg = [new mp.Arg(this.dirs[0], diff),
                       new mp.Arg(diff, this.dirs[1])];
            // magic formula (from MetaFont book)
            function f(arg1, arg2) {
                return (2 + Math.sqrt(2) * (arg1.sin - arg2.sin/16) * (arg2.sin - arg1.sin/16) * (arg1.cos - arg2.cos)) /
                       (3 * (1 + (Math.sqrt(5) - 1) * arg1.cos / 2 + (3 - Math.sqrt(5)) * arg2.cos / 2));
            }
            this.ctrls = [,];
            for(var i = 0; i < 2; i++) {
                var coef = (1-2*i)*(diff.modulus() / this.dirs[i].modulus() * f(arg[i], arg[1-i]) / this.tension[i]);
                this.ctrls[i] = mp.PointFacade.sum(points[i], this.dirs[i].scaled(coef));
            }
        }
    };
    
    meta.paths.Join.prototype.toString = function () {
        var str = ["", ""];
        for(var i = 0; i < 2; i++) {
            if (this.dirs[i] instanceof mp.PointFacade) {
                str[i] = "{" + this.dirs[i] + "}"
            } else if (typeof(this.dirs[i]) === "number") {
                str[i] = "{curl " + this.dirs[i] + "}";
            }
        }
        if (this.isSoft()) {
            return str[0] +  ".. tension " + this.tension.join(" and ") + " .." + str[1];
        } else {
            return str[0] + ".. controls " + this.ctrls.join(" and ") + " .." + str[1];
        }
    };
    
    meta.paths.Join.prototype.isSoft = function () {
        return this.ctrls === undefined;
    };

    // ------- Paths -------
    
    // Main public functions
    
    /** Path class
     * @class
     * @param {Object|Array} p
     */
    meta.paths.Path = function (p) {
        if (p instanceof Array && p.length > 2) {   // array of points and joins
            this.scheme = [new mp.PointFacade(p[0])];
            for (var i = 1; i < p.length; i += 2) {
                this.join(p[i+1], p[i]);
            }
        } else {                                    // point object
            this.scheme = [new mp.PointFacade(p)];
        } 
    };

    /** @param {DomObject} cc  Current canvas context */
    meta.paths.Path.prototype.drawIn = function (cc) {
        var path = this.finalized();
        if (path.nPoints() > 1) {
            cc.moveTo(path.pointNo(0).x(), path.pointNo(0).y());
            for(var i = 0; i < path.nPoints()-1; i++) {
                cc.bezierCurveTo(path.joinNo(i).ctrls[0].x(), path.joinNo(i).ctrls[0].y(),
                                 path.joinNo(i).ctrls[1].x(), path.joinNo(i).ctrls[1].y(),
                                 path.pointNo(i+1).x(), path.pointNo(i+1).y());
            }
        }
    };
    
    /** @param {DomObject} cc  Current canvas context */
    meta.paths.Path.prototype.drawControlsIn = function (cc) {
        var path = this.finalized();
        if (path.nPoints() > 1) {
            cc.moveTo(path.pointNo(0).x(), path.pointNo(0).y());
            for(var i = 0; i < path.nPoints()-1; i++) {
                cc.lineTo(path.joinNo(i).ctrls[0].x(), path.joinNo(i).ctrls[0].y());
                cc.lineTo(path.joinNo(i).ctrls[1].x(), path.joinNo(i).ctrls[1].y());
                cc.lineTo(path.pointNo(i+1).x(), path.pointNo(i+1).y());
            }
        }
    };

    meta.paths.Path.prototype.toString = function () {
        return this.scheme.join("") + (this.isCyclic() ? "cycle" : "");
    };

    meta.paths.Path.parse = function (str) {
        var point = regExp.point.exec(str);
        str = str.substr(point.index + point[0].length);
        var path = new mp.Path(point[0]);
        for (var join = regExp.join.exec(str); join !== null; join = regExp.join.exec(str)) {
            str = str.substr(join.index + join[0].length);
            path.join(join[11], join); // TODO
        }
        return path;
    };

    // Additional public functions
    
    meta.paths.Path.prototype.pointNo = function (n) {
        n = this.correctPointIndex(n);
        return this.scheme[2*n];
    };
    
    meta.paths.Path.prototype.joinNo = function (n) {
        n = this.correctPointIndex(n);
        if (n === this.nPoints()-1 && !this.isCyclic()) {
            n--;
        }
        return this.scheme[2*n + 1];
    };
    
    /** Add ..join..p to path (in meta* notation)
     * @param {Object|mp.Path} p
     * @param {Object} join
     */
    meta.paths.Path.prototype.join = function (p, join) { // p = point or path
        join = new mp.Join(join);
        this.uncycle();
        this.scheme.push(join);
        if (p !== "cycle") {
            if (p instanceof mp.Path) { // p = path
                p.uncycle();
                // copy all 'p' info to 'this' (TODO: copy refs or values?)
                for (var i = 0; i < p.scheme.length; i++) {
                    this.scheme.push(p.scheme[i]);
                }
            } else {                    // p = point
                this.scheme.push(new mp.PointFacade(p));
            }
        }                
        return this;
    };

    /** Copy of current path with calculated controls */
    meta.paths.Path.prototype.finalized = function () {
        var path = this.snapshot();
        path.castCtrlsToDirs();
        if (!path.isCyclic()) {
            // set default curl:
            path.joinNo(0).dirs[0] = path.joinNo(0).dirs[0] || 1;
            path.joinNo(path.nJoins()-1).dirs[1] = path.joinNo(path.nJoins()-1).dirs[1] || 1;
        }
        for (var subpath in path.undefinedSubpaths()) {
            path.fitOptimalDirs(subpath);
        }
        path.uncycle();
        path.castDirsToCtrls();
        return path;
    };
    
    /** Static (independent) copy of current path */
    meta.paths.Path.prototype.snapshot = function () {
        var path = new mp.Path(this.pointNo(0).snapshot());
        for (var i = 1; i < this.nPoints(); i++) {
            path.join(this.pointNo(i).snapshot(), new mp.Join(this.joinNo(i-1)));
        }
        if (this.isCyclic()) {
            path.join("cycle", new mp.Join(this.joinNo(-1)));
        }
        // actually mp.Join constructor doesn't copy direction points (TODO?) 
        return path;
    };
    
    meta.paths.Path.prototype.isCyclic = function () {    
        return this.scheme.length % 2 == 0;
    };
    
    meta.paths.Path.prototype.nPoints = function () {
        return parseInt((this.scheme.length + 1) / 2);
    };
    
    meta.paths.Path.prototype.nJoins = function () {
        return parseInt(this.scheme.length / 2);
    };

    
    // Auxiliary functions
    
    meta.paths.Path.prototype.uncycle = function () {
        if(this.isCyclic()) {
            this.scheme.push(this.point(0));
        }
    };
    
    meta.paths.Path.prototype.castCtrlsToDirs = function () {
        for (var i = 0; i < this.nJoins(); i++) {
            this.joinNo(i).castCtrlsToDirs([this.pointNo(i), this.pointNo(i+1)]);
        }
        for (var i = 0; i < this.nJoins()-1; i++) {
            this.joinNo(i).shareDirs(this.joinNo(i+1));
        }
        if (this.isCyclic()) {
            this.joinNo(-1).shareDirs(this.JoinNo(0));
        }
    };
    
    meta.paths.Path.prototype.undefinedSubpaths = function () {
        var subpaths = [];
        var bound = undefined;
        var type = undefined;
        if (this.joinNo(0).dirs[0] === undefined) {
            bound = -1;
        } 
        for (var i = 0; i < this.nJoins(); i++) {
            var dirs = this.joinNo(i).dirs;
            if (dirs[0] !== undefined) {
                bound = i;
                type = typeof(dirs[0]);
            }
            if (dirs[1] !== undefined && (i > bound || typeof(dirs[1]) !== type)) {
                subpaths.push([bound, i]);
            }
        }
        if (bound === -1) {
            subpath.push([0, 0]);
        }
        if (subpaths[0] && subpaths[0][0] === -1) {
            subpaths[0][0] = bound - this.nJoins(); // TODO: check
        }
        return subpaths;
    };
    
    meta.paths.Path.prototype.fitOptimalDirs = function (subpath) {
        // TODO
    };
    
    meta.paths.Path.prototype.castDirsToCtrls = function () {
        for (var i = 0; i < this.nJoins(); i++) {
            this.joinNo(i).castDirsToCtrls([this.pointNo(i), this.pointNo(i+1)]);
        }
    };
    
    meta.paths.Path.prototype.correctPointIndex = function (time) {
        if (this.isCyclic()) {
            return Math.mod(time, this.nPoints());
        } else {
            return Math.max(0, Math.min(time, this.nPoints()-1));
        }
    };

    // Tests
    (function () {
        function print(o) {
            document.write(o, "<br/>");
        }
        var testStr = "...{}(1.23,-2.11){}..";
        print(regExp.dir.exec("sas{(1,3)}asdad").join("; "));
        print(regExp.ctrls.exec("controls (1,2)"));
        print(typeof(regExp.join.exec("{curl 2}..controls (1,2) and (4,5)..{1,2}cycle")[4]));
        var p = mp.PointFacade.parse("(1,2.4)");
        print(p.x + " " + p.y);
        print(mp.Path.parse("(1,2){curl 1}..controls (1,2)..{1,2}(2,3)"));
    }) ();
    
}) ();

