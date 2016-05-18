var precision = 1000;
var round = function (number) {
    return Math.round((number * precision)) / precision;
};

var median = function (numbers) {

    numbers.sort(function (a, b) {
        return a - b;
    });

    var half = Math.floor(numbers.length / 2);
    if (numbers.length % 2) {
        return numbers[half];
    }
    else {
        return (numbers[half - 1] + numbers[half]) / 2.0;
    }
};

var pad = function (n) {
    return n < 10 ? '0' + n : n;
};

var cloneRow = function (object) {
    return {
        date: object.date,
        ax: object.ax,
        ay: object.ay,
        az: object.az,
        lat: object.lat,
        lng: object.lng,
        v: object.v
    };
};

function DataSet(data) {
    this.data = data;
}

DataSet.prototype.min = function (col) {
    var min = Infinity;

    for (i = 0; i < this.data.length; i++) {
        var num = this.data[i][col];
        if (num < min) {
            min = num;
        }
    }
    return min;
};

DataSet.prototype.max = function (col) {
    var max = -Infinity;
    for (i = 0; i < this.data.length; i++) {
        var num = this.data[i][col];
        if (num > max) {
            max = num;
        }
    }
    return max;
};

DataSet.prototype.avg = function (col) {
    var sum = 0;
    for (i = 0; i < this.data.length; i++) {
        var num = this.data[i][col];
        sum = sum + num;
    }
    return sum / this.data.length;
};

DataSet.prototype.stDev = function (col) {
    var avg = this.avg(col);
    var sum = 0;
    for (i = 0; i < this.data.length; i++) {
        var num = this.data[i][col] - avg;
        sum = sum + num * num;
    }

    result = Math.sqrt(sum / this.data.length);

    return result;
};

DataSet.prototype.getDygraphArray = function (cols) {
    file = [];
    for (i = 0; i < this.data.length; i++) {
        file[i] = new Array(cols.length);
        for (j = 0; j < cols.length; j++) {
            file[i][j] = this.data[i][cols[j]];
        }
    }

    return {file: file, labels: cols};
};

DataSet.prototype.filterMavg = function () {
    var radius = 10;
    result = [];
    for (i = 0; i < this.data.length; i++) {
        var subsum = [0, 0, 0];
        var subcount = 0;

        for (j = -radius; j <= radius; j++) {
            if (i + j < this.data.length && i + j > 0) {
                subsum[0] = subsum[0] + this.data[i + j].ax;
                subsum[1] = subsum[1] + this.data[i + j].ay;
                subsum[2] = subsum[2] + this.data[i + j].az;
                subcount++;
            }
        }

        result[i] = {
            date: this.data[i].date,
            ax: subsum[0] / subcount,
            ay: subsum[1] / subcount,
            az: subsum[2] / subcount,
            lat: this.data[i].lat,
            lng: this.data[i].lng,
            v: this.data[i].v
        };

        result[i].a = magnitude(result[i].ax, result[i].ay, result[i].az);

    }

    return new DataSet(result);
};

DataSet.prototype.filterEmMavg = function (a) {
    var radius = 10;
    //var a = 1.5;
    result = [];
    for (i = 0; i < this.data.length; i++) {
        var subsum = [0, 0, 0];

        var before = Math.min(i, radius);
        var after = Math.min(this.data.length - i - 1, radius);

        var maxDistance = Math.max(before, after);

        var coefficient = Math.pow(a, maxDistance);

        subsum[0] = this.data[i].ax * coefficient;
        subsum[1] = this.data[i].ay * coefficient;
        subsum[2] = this.data[i].az * coefficient;

        var subcount = coefficient;

        for (j = 0; j < before; j++) {
            var coefficient = Math.pow(a, maxDistance - j - 1);

            subsum[0] = subsum[0] + coefficient * this.data[i - j - 1].ax;
            subsum[1] = subsum[1] + coefficient * this.data[i - j - 1].ay;
            subsum[2] = subsum[2] + coefficient * this.data[i - j - 1].az;

            subcount = subcount + coefficient;
        }

        for (j = 0; j < after; j++) {
            var coefficient = Math.pow(a, maxDistance - j - 1);

            subsum[0] = subsum[0] + coefficient * this.data[i + j + 1].ax;
            subsum[1] = subsum[1] + coefficient * this.data[i + j + 1].ay;
            subsum[2] = subsum[2] + coefficient * this.data[i + j + 1].az;

            subcount = subcount + coefficient;
        }


        result[i] = {
            date: this.data[i].date,
            ax: subsum[0] / subcount,
            ay: subsum[1] / subcount,
            az: subsum[2] / subcount,
            lat: this.data[i].lat,
            lng: this.data[i].lng,
            v: this.data[i].v
        };

        result[i].a = magnitude(result[i].ax, result[i].ay, result[i].az);

    }

    return new DataSet(result);
};

function lowPass(current, filtered, a) {
    return a * current + (1.0 - a) * filtered;
}

DataSet.prototype.filterLowPass = function (a) {
    result = [];
    for (i = 0; i < this.data.length; i++) {
        result[i] = {
            date: this.data[i].date,
            ax: 0,
            ay: 0,
            az: 0,
            lat: this.data[i].lat,
            lng: this.data[i].lng,
            v: this.data[i].v
        };

        if (i == 0) {
            result[i].ax = this.data[i].ax;
            result[i].ay = this.data[i].ay;
            result[i].az = this.data[i].az;
        } else {
            result[i].ax = lowPass(this.data[i].ax, result[i - 1].ax, a);
            result[i].ay = lowPass(this.data[i].ay, result[i - 1].ay, a);
            result[i].az = lowPass(this.data[i].az, result[i - 1].az, a);
        }

        result[i].a = magnitude(result[i].ax, result[i].ay, result[i].az);

    }

    return new DataSet(result);
};


DataSet.prototype.filterMedian = function () {
    var radius = 10;
    result = [];
    for (i = 0; i < this.data.length; i++) {
        var subSets = [[], [], []];

        for (j = -radius; j <= radius; j++) {
            if (i + j < this.data.length && i + j > 0) {
                subSets[0].push(this.data[i + j].ax);
                subSets[1].push(this.data[i + j].ay);
                subSets[2].push(this.data[i + j].az);
            }
        }

        result[i] = {
            date: this.data[i].date,
            ax: median(subSets[0]),
            ay: median(subSets[1]),
            az: median(subSets[2]),
            lat: this.data[i].lat,
            lng: this.data[i].lng,
            v: this.data[i].v
        };

        result[i].a = magnitude(result[i].ax, result[i].ay, result[i].az);

    }

    return new DataSet(result);
};

/**
 * 
 * @param int a Oneskorenie rychlosti po zastaveni v ms
 * @param int b Oneskorenie rychlosti po rozbehnuti v ms
 * @returns {array}
 */
DataSet.prototype.getStops = function (a, b) {
    //Najdenie bodov kde je zmena rychlosti na nulu alebo z nuly
    var changePoints = [];
    //Pre prvy bod
    if (this.data.length > 0 && this.data[0].v == 0) {
        changePoints.push(this.data[0]);
    }
    for (i = 1; i < this.data.length; i++) {
        if (this.data[i - 1].v == 0 && this.data[i].v > 0) {
            changePoints.push(this.data[i]);
        } else if (this.data[i - 1].v > 0 && this.data[i].v == 0) {
            changePoints.push(this.data[i]);
        }
    }
    //Pre posl. bod
    if (this.data.length > 0 && this.data[this.data.length - 1].v == 0) {
        changePoints.push(this.data[this.data.length - 1]);
    }

    var filteredPoints = [];
    // Vyfiltrovanie intervalov ktore su mensie alebo rovne rozdielu oneskoreni
    for (i = 0; i < changePoints.length / 2; i++) {
        if ((changePoints[i * 2 + 1].date.getTime()) - (changePoints[i * 2].date.getTime()) > (b - a)) {
            var pointStart = cloneRow(changePoints[i * 2]);
            pointStart.date=new Date(pointStart.date - a);
            filteredPoints.push(pointStart);
            var pointEnd = cloneRow(changePoints[i * 2 + 1]);
            pointEnd.date=new Date(pointEnd.date - b);
            filteredPoints.push(pointEnd);
        }
    }

    return filteredPoints;
};

/**
 * 
 * @param int a Oneskorenie rychlosti po zastaveni v ms
 * @param int b Oneskorenie rychlosti po rozbehnuti v ms
 * @returns {DataSet|DataSet.prototype}
 */
DataSet.prototype.skipStops = function (a, b) {

    /*if (this.avg('v') == 0) {
        return this;
    }*/
    
    var filteredPoints = this.getStops(a, b);
    var result = [];
    
    for (i = 0; i < this.data.length; i++) {
        var stop = false;
        for (j = 0; j < filteredPoints.length / 2; j++) {
            if (this.data[i].date.getTime() >= filteredPoints[j * 2].date.getTime() &&
                    this.data[i].date.getTime() < filteredPoints[j * 2 + 1].date.getTime()) {
                stop = true;
                break;
            }
        }
        if (stop == false) {
            result.push(this.data[i]);
        }
    }

    return new DataSet(result);

};

/**
 * 
 * @param Array rawData
 * Musi byt vo formate: cas; ax; ay; az; latitude; longitude; rychlost .
 */
var AppData = function (rawData) {
    this.rawData = [];
    for (i = 0; i < rawData.length; i++) {
        this.rawData[i] = {
            date: new Date(parseInt(rawData[i][0])),
            ax: parseFloat(rawData[i][1]),
            ay: parseFloat(rawData[i][2]),
            az: parseFloat(rawData[i][3]),
            lat: parseFloat(rawData[i][4]),
            lng: parseFloat(rawData[i][5]),
            v: parseFloat(rawData[i][6])

        };
    }

};


AppData.prototype.getUnfilteredData = function () {
    result = [];
    for (i = 0; i < this.rawData.length; i++) {
        result[i] = {
            date: this.rawData[i].date,
            ax: this.rawData[i].ax,
            ay: this.rawData[i].ay,
            az: this.rawData[i].az,
            a: magnitude(this.rawData[i].ax, this.rawData[i].ay, this.rawData[i].az),
            lat: this.rawData[i].lat,
            lng: this.rawData[i].lng,
            v: this.rawData[i].v
        };
    }

    return new DataSet(result);
};


var AppView = function (elem, app) {
    this.elem = elem;
    this.app = app;
    this.currentData = new DataSet([]);
};

AppView.prototype.init = function () {

};

AppView.prototype.destroy = function () {

};


function StartView(elem, app) {
    AppView.call(this, elem, app);

}

StartView.prototype = Object.create(AppView.prototype);
StartView.prototype.constructor = StartView;

function MapView(elem) {
    AppView.call(this, elem, app);

    this.canvasLeft = this.elem.find("#map-canvas-left");
    this.canvasRight = this.elem.find("#map-canvas-right");
    this.legendLeft = this.elem.find("#legend-left");
    this.legendRight = this.elem.find("#legend-right");

    this.legendLeft.on('hidden.bs.collapse', function (e) {
        var icon = $(e.target).find("h4 .btn .glyphicon");
        //console.log(icon);
        icon.removeClass("glyphicon-chevron-down");
        icon.addClass("glyphicon-chevron-up");
    });

    this.legendLeft.on('shown.bs.collapse', function (e) {
        var icon = $(e.target).find("h4 .btn .glyphicon");
        //console.log(icon);
        icon.removeClass("glyphicon-chevron-up");
        icon.addClass("glyphicon-chevron-down");
    });

    this.legendRight.on('hidden.bs.collapse', function (e) {
        var icon = $(e.target).find("h4 .btn .glyphicon");
        //console.log(icon);
        icon.removeClass("glyphicon-chevron-down");
        icon.addClass("glyphicon-chevron-up");
    });

    this.legendRight.on('shown.bs.collapse', function (e) {
        var icon = $(e.target).find("h4 .btn .glyphicon");
        //console.log(icon);
        icon.removeClass("glyphicon-chevron-up");
        icon.addClass("glyphicon-chevron-down");
    });

    this.speedBounds = [{min: 0, max: 10}, {min: 10, max: 30}, {min: 30, max: 50}, {min: 50, max: 60}, {min: 60, max: 70}, {min: 70, max: 90}, {min: 90, max: 110}, {min: 110, max: 130}, {min: 130, max: 150}, {min: 150, max: Infinity}];
    this.accelBounds = [{min: 0, max: 0.5}, {min: 0.5, max: 1}, {min: 1, max: 1.5}, {min: 1.5, max: 2}, {min: 2, max: 2.5}, {min: 2.5, max: Infinity}];

    this.colorsV = ["black", "green", "lime", "lightblue", "blue", "#ad00b3", "orange", "#FF6900", "red", "#8B0000"];
    this.colorsA = ["black", "green", "lime", "#FFE400", "#FF8C00", "#FF0000"];

}

MapView.prototype = Object.create(AppView.prototype);
MapView.prototype.constructor = MapView;

MapView.prototype.init = function () {
    mapView = this;

    var center = new google.maps.LatLng(processedData[0][0].lat(), processedData[0][0].lng());
    this.mapLeft = this.createMap(this.canvasLeft, this.legendLeft, center);
    this.mapRight = this.createMap(this.canvasRight, this.legendRight, center);
    this.drawTrajectorySpeed(this.mapLeft, processedData);
    this.drawTrajectoryAccel(this.mapRight, processedData);
    this.initLegendV(this.legendLeft);
    this.initLegendA(this.legendRight);
    this.eventBlock = false;

    var rightToLeft = function () {
        if (!mapView.eventBlock) {
            mapView.eventBlock = true;
            mapView.mapLeft.setZoom(mapView.mapRight.getZoom());
            mapView.mapLeft.setCenter(mapView.mapRight.getCenter());
            mapView.eventBlock = false;
        }
    };

    var leftToRight = function () {
        if (!mapView.eventBlock) {
            mapView.eventBlock = true;
            mapView.mapRight.setZoom(mapView.mapLeft.getZoom());
            mapView.mapRight.setCenter(mapView.mapLeft.getCenter());
            mapView.eventBlock = false;
        }
    };

    google.maps.event.addListener(this.mapRight, 'drag', rightToLeft);
    google.maps.event.addListener(this.mapRight, 'dragend', rightToLeft);
    google.maps.event.addListener(this.mapRight, 'zoom_changed', rightToLeft);
    google.maps.event.addListener(this.mapLeft, 'drag', leftToRight);
    google.maps.event.addListener(this.mapLeft, 'dragend', leftToRight);
    google.maps.event.addListener(this.mapLeft, 'zoom_changed', leftToRight);
};

MapView.prototype.destroy = function () {
    this.mapLeft = null;
    this.mapRight = null;

    this.canvasLeft.html("");
    this.canvasRight.html("");

};

MapView.prototype.createMap = function (canvas, legend, center) {
    var mapOptions = {
        zoom: 15,
        center: center,
        scaleControl: true
    };
    var map = new google.maps.Map(canvas.get(0), mapOptions);
    map.controls[google.maps.ControlPosition.RIGHT_BOTTOM].push(legend.get(0));
    return map;
};

MapView.prototype.initLegendV = function (legend) {
    var ul = legend.find("ul.intervals");
    ul.html("<li><h4>Rýchlosť od-do:</h4></li>");
    for (var i = 0; i < this.speedBounds.length; i++) {
        var bound = this.speedBounds[i];
        var content = "";
        content += "<li>";
        content += "<div class=\"color\"></div>";
        if (bound.max != Infinity) {
            content += "<div class=\"description\">" + bound.min + " - " + bound.max + "km.h<sup>-1</sup></div>";
        } else {
            content += "<div class=\"description\">&gt " + bound.min + "km.h<sup>-1</sup></div>";
        }
        content += "</li>";
        ul.append(content);
        ul.children().last().find('.color').css('backgroundColor', this.colorsV[i]);
    }
};

MapView.prototype.initLegendA = function (legend) {
    var ul = legend.find("ul.intervals");
    ul.html("<li><h4>Zrýchlenie od-do:</h4></li>");
    for (var i = 0; i < this.accelBounds.length; i++) {
        var bound = this.accelBounds[i];
        var content = "";
        content += "<li>";
        content += "<div class=\"color\"></div>";
        if (bound.max != Infinity) {
            content += "<div class=\"description\">" + bound.min + " - " + bound.max + "m.s<sup>-2</sup></div>";
        } else {
            content += "<div class=\"description\">&gt; " + bound.min + "m.s<sup>-2</sup></div>";
        }
        content += "</li>";
        ul.append(content);
        ul.children().last().find('.color').css('backgroundColor', this.colorsA[i]);
    }
};

MapView.prototype.drawTrajectorySpeed = function (map, processedData) {
    createLetteredMarker(processedData[0][0], "Z", map);
    createLetteredMarker(processedData[processedData.length - 1][0], "K", map);
    for (i = 0; i < processedData.length - 1; i++) {
        var start = processedData[i][0];
        var end = processedData[i + 1][0];
        var time = processedData[i][2];
        var speed = (parseInt(processedData[i][1]) + parseInt(processedData[i + 1][1])) / 2.0;
        var color = this.colorsV[this.getSpeedLevel(speed)];
        drawLineSpeed(time, speed, color, [start, end], map);
    }
    for (i = 1; i < stopPoints.length; i++) {
        createLetteredMarker(stopPoints[i], "S", map);
    }

};

MapView.prototype.drawTrajectoryAccel = function (map, processedData) {
    createLetteredMarker(processedData[0][0], "Z", map);
    createLetteredMarker(processedData[processedData.length - 1][0], "K", map);
    for (i = 0; i < processedData.length - 1; i++) {

        var start = processedData[i][0];
        var end = processedData[i + 1][0];
        var time = processedData[i][2];
        var a = parseFloat(processedData[i][6]);
        var color = this.colorsA[this.getAccelLevel(a)];
        drawLineAccel(time, a, color, [start, end], map);
    }
    for (i = 1; i < stopPoints.length; i++) {
        createLetteredMarker(stopPoints[i], "S", map);
    }
};

MapView.prototype.getLevel = function (value, bounds) {
    for (var i = 0; i < bounds.length; i++) {
        var bound = bounds[i];
        if (value <= bound.max && value >= bound.min) {
            return i;
        }
    }
    return 0;
};

MapView.prototype.getSpeedLevel = function (speed) {
    return this.getLevel(speed, this.speedBounds);
};

MapView.prototype.getAccelLevel = function (accel) {
    return this.getLevel(accel, this.accelBounds);
};


function GraphView(elem, app) {
    AppView.call(this, elem, app);

    this.chartElement = this.elem.find("#chart");
    this.dataSwitch = this.elem.find("input[name=dataSet]");
    this.dataExport = this.elem.find("#exportData");
    this.columnSwitch = this.elem.find("input[name=dataColumns]");
    this.filterStops = this.elem.find("input[name=filterStops]");
    this.panRight = this.elem.find("#panright");
    this.panLeft = this.elem.find("#panleft");
    this.pan30Sec = this.elem.find("#pan30sec");
    this.pan1Min = this.elem.find("#pan1min");
    this.panReset = this.elem.find("#panreset");
    this.dygraph = null;

    var view = this;

    $(document).keydown(function (e) {
        if (view.dygraph != null) {
            switch (e.keyCode) {
                case 37:
                    view.panGraph(-1);
                    break;
                case 39:
                    view.panGraph(1);
                    break;
            }
        }
    });

    this.panRight.click(function () {
        view.panGraph(-1);
    });

    this.panLeft.click(function () {
        view.panGraph(1);
    });

    this.panReset.click(function () {
        view.dygraph.resetZoom();
    });

    this.pan30Sec.click(function () {
        view.setRangeLength(30000);
    });

    this.pan1Min.click(function () {
        view.setRangeLength(60000);
    });

    this.dataExport.click(function () {
        view.exportCurrentData();
    });

    this.dataSwitch.change(function () {
        view.initData($(this).val());
        view.fillTable();
        view.updateGraph();
    });

    this.columnSwitch.change(function () {
        view.updateGraph();
    });

    this.filterStops.change(function () {
        view.updateGraph();
        view.fillTable();
    });

}

GraphView.prototype = Object.create(AppView.prototype);
GraphView.prototype.constructor = GraphView;

GraphView.prototype.init = function () {
    this.initData(this.dataSwitch.val());
    this.fillTable();

    this.chartElement.css("width", this.elem.width());
    this.createGraph();

    this.elem.find('[data-toggle="popover"]').each(function () {
        $(this).popover();
    });
};

GraphView.prototype.destroy = function () {
    this.active = false;
    this.destroyGraph();
    this.currentData = null;
    this.elem.find('[data-toggle="popover"]').popover('destroy');
};

GraphView.prototype.destroyGraph = function () {
    if (this.dygraph != null) {
        this.dygraph.destroy();
    }
};

GraphView.prototype.createGraph = function () {
    data = this.currentData.getDygraphArray(this.getSelectedColumns());
    this.dygraph = new Dygraph(this.chartElement.get(0),
            data.file,
            {
                labels: data.labels,
                series: {
                    v: {
                        axis: 'y2',
                        color: 'rgb(158, 0, 25)',
                        showInRangeSelector: true
                    },
                    ax: {
                        color: 'rgb(44, 255, 0)'
                    },
                    ay: {
                        color: 'rgb(217, 126, 0)'
                    },
                    az: {
                        color: 'rgb(0, 76, 140)'
                    },
                    a: {
                        color: 'rgb(255, 0, 24)'
                    }
                },
                xlabel: 'Čas',
                ylabel: '<b>Zrýchlenie</b> [m.s<sup>-2</sup>]',
                y2label: '<b>Rýchlosť</b>  [km.h<sup>-1</sup>]',
                axes: {
                    y: {
                        valueRange: [-8, 8]
                    },
                    y2: {
                        digitsAfterDecimal: 1
                    }
                },
                height: 600,
                gridLineColor: 'rgb(192,192,192)',
                showRangeSelector: true,
                legend: 'always',
                labelsDivWidth: '350',
                digitsAfterDecimal: Math.log10(precision)
            });
};

GraphView.prototype.updateGraph = function () {
    this.dygraph.updateOptions(this.currentData.getDygraphArray(this.getSelectedColumns()));
    //this.destroyGraph();
    //this.createGraph();
};

GraphView.prototype.initData = function (set) {
    var data;
    switch (set) {
        case "mavg":
            data = this.app.data.getUnfilteredData().filterMavg();
            break;
        case "emavg":
            data = this.app.data.getUnfiltredData().filterEmMavg();
            break;
        case "emavg2":
            data = this.app.data.getUnfilteredData().filterEmMavg(2);
            break;
        case "emavg15":
            data = this.app.data.getUnfilteredData().filterEmMavg(1.5);
            break;
        case "emavg175":
            data = this.app.data.getUnfilteredData().filterEmMavg(1.75);
            break;
        case "lowpass75":
            data = this.app.data.getUnfilteredData().filterLowPass(0.75);
            break;
        case "lowpass5":
            data = this.app.data.getUnfilteredData().filterLowPass(0.5);
            break;
        case "lowpass25":
            data = this.app.data.getUnfilteredData().filterLowPass(0.25);
            break;
        case "median":
            data = this.app.data.getUnfilteredData().filterMedian();
            break;
        default:
            data = this.app.data.getUnfilteredData();
            break;
    }

    this.currentData = data;
};


GraphView.prototype.panGraph = function (direction) {
    var w = this.dygraph.xAxisRange();
    var e = this.dygraph.xAxisExtremes();
    //var scale = w[1] - w[0];
    var amount = 1000 * direction;

    newRange = [w[0] + amount, w[1] + amount];

    if (newRange[0] < e[0]) {
        newRange[0] = e[0];
    }

    if (newRange[1] > e[1]) {
        newRange[1] = e[1];
    }

    this.dygraph.updateOptions({dateWindow: newRange});
};

GraphView.prototype.setRangeLength = function (length) {
    var w = this.dygraph.xAxisRange();
    var e = this.dygraph.xAxisExtremes();

    if (w[0] + length <= e[1]) {
        newRange = [w[0], w[0] + length];
        this.dygraph.updateOptions({dateWindow: newRange});
    }
};

GraphView.prototype.getSelectedColumns = function () {
    var columns = ['date'];
    this.columnSwitch.each(function () {
        if ($(this).is(":checked")) {
            columns.push($(this).val());
        }
    });
    return columns;
};

GraphView.prototype.fillTable = function () {
    if (this.filterStops.is(":checked")) {
        var data = this.currentData.skipStops(1000, 5000);
    } else {
        var data = this.currentData;
    }

    this.elem.find("#minAx").html(round(data.min('ax')));
    this.elem.find("#minAy").html(round(data.min('ay')));
    this.elem.find("#minAz").html(round(data.min('az')));
    this.elem.find("#minA").html(round(data.min('a')));
    this.elem.find("#minV").html(round(data.min('v')));

    this.elem.find("#maxAx").html(round(data.max('ax')));
    this.elem.find("#maxAy").html(round(data.max('ay')));
    this.elem.find("#maxAz").html(round(data.max('az')));
    this.elem.find("#maxA").html(round(data.max('a')));
    this.elem.find("#maxV").html(round(data.max('v')));

    this.elem.find("#avgAx").html(round(data.avg('ax')));
    this.elem.find("#avgAy").html(round(data.avg('ay')));
    this.elem.find("#avgAz").html(round(data.avg('az')));
    this.elem.find("#avgA").html(round(data.avg('a')));
    this.elem.find("#avgV").html(round(data.avg('v')));

    this.elem.find("#devAx").html(round(data.stDev('ax')));
    this.elem.find("#devAy").html(round(data.stDev('ay')));
    this.elem.find("#devAz").html(round(data.stDev('az')));
    this.elem.find("#devA").html(round(data.stDev('a')));
    this.elem.find("#devV").html(round(data.stDev('v')));

};

GraphView.prototype.exportCurrentData = function () {

    var result = $.csv.fromObjects(this.currentData.data, {separator: ';'});
    for(i = 0; i<result.length;i++){
        result[i].date = result[i].date.getTime();
    }
    //console.log(this.currentData.data);
    var blob = new Blob([result], {type: "text/csv;charset=utf-8"});
    saveAs(blob, "export.csv");
};

var App = function () {
    this.contentElement = $("#content");
    this.hiddenElement = $("#hidden");
    this.views = {
        start: new StartView($("#start"), this),
        map: new MapView($("#map"), this),
        graph: new GraphView($("#graph"), this)
    };
    this.setView("start");
};

App.prototype.setView = function (view) {
    var views = this.views;
    for (var key in views) {
        if (key == view) {
            views[key].elem.appendTo(this.contentElement);
            views[key].init();
        } else {
            views[key].destroy();
            views[key].elem.appendTo(this.hiddenElement);
        }
    }
};
/**
 * 
 * @param AppData appData
 */
App.prototype.setData = function (appData) {
    this.data = appData;
};

var stopPoints = new Array();

function magnitude(x, y, z) {
    return Math.sqrt(x * x + y * y + z * z);
}


/*function getLevelBounds(maxspeed, levelcount) {
 var interval = maxspeed / levelcount;
 var result = new Array(levelcount);
 for (var i = 0; i < levelcount; i++) {
 var min = Math.round(interval * i);
 var max = Math.round(interval * (i + 1));
 result[i] = {'min': min, 'max': max};
 }
 return result;
 }*/

/*function getLevelBoundsA(maxaccel, levelcount) {
 var interval = maxaccel / levelcount;
 var result = new Array(levelcount);
 for (var i = 0; i < levelcount; i++) {
 var min = interval * i;
 var max = interval * (i + 1);
 result[i] = {'min': min, 'max': max};
 }
 return result;
 }*/

/*function getMaxSpeed(data) {
 var maxspeed = 0;
 for (i = 0; i < data.length - 1; i++) {
 var speed = (parseInt(data[i][1]) + parseInt(data[i + 1][1])) / 2.0;
 if (speed > maxspeed) {
 maxspeed = speed;
 }
 }
 return maxspeed;
 }*/

/*function getMaxAccel(data, offset) {
 var maxaccel = 0;
 for (i = 0; i < data.length - 1; i++) {
 var accel = (parseFloat(data[i][3 + offset]) + parseInt(data[i + 1][3 + offset])) / 2.0;
 if (accel > maxaccel) {
 maxaccel = accel;
 }
 }
 return maxaccel;
 }*/


function drawLineSpeed(time, speed, color, routeCoordinates, map) {
    var timeo = new Date(parseInt(time));
    var marker = new MarkerWithLabel({
        position: new google.maps.LatLng(0, 0),
        draggable: false,
        raiseOnDrag: false,
        map: map,
        labelContent: "<center style='cursor: none'>" + timeo.getHours() + ":" + pad(timeo.getMinutes()) + ":" + pad(timeo.getSeconds()) + "<br/>" + speed + "km.h<sup>-1</sup></center>",
        labelAnchor: new google.maps.Point(30, 20),
        labelClass: "labels", // the CSS class for the label
        labelStyle: {opacity: 1.0},
        icon: "http://placehold.it/1x1",
        visible: false
    });
    var path = new google.maps.Polyline({
        path: routeCoordinates,
        geodesic: true,
        strokeColor: color,
        strokeOpacity: 1.0,
        strokeWeight: 5
    });
    google.maps.event.addListener(path, "mousemove", function (event) {
        marker.setPosition(event.latLng);
        marker.setVisible(true);
    });
    google.maps.event.addListener(path, "mouseout", function (event) {
        marker.setVisible(false);
    });
    path.setMap(map);
}

function drawLineAccel(time, a, color, routeCoordinates, map) {
    var timeo = new Date(parseInt(time));
    var marker = new MarkerWithLabel({
        position: new google.maps.LatLng(0, 0),
        draggable: false,
        raiseOnDrag: false,
        map: map,
        labelContent: "<center style='cursor: none'>" + timeo.getHours() + ":" + pad(timeo.getMinutes()) + ":" + pad(timeo.getSeconds()) + "<br/>" + Math.round(a * 100) / 100 + "m.s<sup>-2</sup></center>",
        labelAnchor: new google.maps.Point(30, 20),
        labelClass: "labels", // the CSS class for the label
        labelStyle: {opacity: 1.0},
        icon: "http://placehold.it/1x1",
        visible: false
    });
    var path = new google.maps.Polyline({
        path: routeCoordinates,
        geodesic: true,
        strokeColor: color,
        strokeOpacity: 1.0,
        strokeWeight: 5
    });
    google.maps.event.addListener(path, "mousemove", function (event) {
        marker.setPosition(event.latLng);
        marker.setVisible(true);
    });
    google.maps.event.addListener(path, "mouseout", function (event) {
        marker.setVisible(false);
    });
    path.setMap(map);
}

function createLetteredMarker(coordinates, letter, map) {

    marker = new google.maps.Marker({
        map: map,
        position: coordinates,
        icon: "res/marker" + letter + ".png",
        animation: google.maps.Animation.DROP
    });
    return marker;
}

function preprocessData(data) {
    var result = new Array();
    if (data.length > 0) {
        var firstTimestamp = data[0][0];
        var aX = parseFloat(data[0][1]);
        var aY = parseFloat(data[0][2]);
        var aZ = parseFloat(data[0][3]);
        for (i = 0; i < data.length; i++) {
            var row = new Array(2);
            var point = new google.maps.LatLng(data[i][4], data[i][5]);
            if (point.lat() != 0 && point.lng() != 0) {
                aX = (parseFloat(data[i][1]) + aX) / 2.0;
                aY = (parseFloat(data[i][2]) + aY) / 2.0;
                aZ = (parseFloat(data[i][3]) + aZ) / 2.0;
                if (result.length == 0 || !(result[result.length - 1][0].lat() == point.lat() && result[result.length - 1][0].lng() == point.lng())) {
                    row[0] = point;
                    row[1] = data[i][6];
                    row[2] = data[i][0];
                    row[3] = aX;
                    row[4] = aY;
                    row[5] = aZ;
                    a = Math.sqrt(aX * aX + aY * aY + aZ * aZ);
                    row[6] = a;
                    if (i != data.length - 1) {
                        aX = parseFloat(data[i + 1][1]);
                        aY = parseFloat(data[i + 1][2]);
                        aZ = parseFloat(data[i + 1][3]);
                    }
                    if (result.length == 0) {
                        stopPoints.push(point);
                    }
                    if (row[1] < 1) {
                        distance = google.maps.geometry.spherical.computeDistanceBetween(point, stopPoints[stopPoints.length - 1]);
                        if (distance > 50) {
                            stopPoints.push(point);
                        }
                    }
                    result.push(row);
                }
            }
        }
    }
    if (result.length != 0) {
        if (google.maps.geometry.spherical.computeDistanceBetween(result[result.length - 1][0], stopPoints[stopPoints.length - 1]) < 50) {
            stopPoints.pop();
        }
    }
    return result;
}


function calculateDistance(processeddata) {
    var result = 0;
    for (i = 1; i < processeddata.length; i++) {
        result = result + google.maps.geometry.spherical.computeDistanceBetween(processeddata[i - 1][0], processeddata[i][0]);
    }

    return result;
}

var processedData;
var app;
function initialize() {
    app = new App();
    var csvdata;
    $('#datafile').bind('change', function (evt) {
        var files = evt.target.files;
        var file = files[0];
        var reader = new FileReader();
        reader.readAsText(file);
        reader.onload = function (event) {
            $("#header").show();
            csvdata = event.target.result;
            var data = $.csv.toArrays(csvdata, {separator: ';'});
            processedData = preprocessData(data);
            //TODO fix this ugly hack
            if (data.length > 0) {
                date1 = new Date(parseInt(data[0][0]));
                date2 = new Date(parseInt(data[data.length - 1][0]));
                diff = date2 - date1;
                $("#header h3").html("<span class='label label-default'>Dátum</span> " + date1.getDate() + "." + date1.getMonth() + "." + date1.getFullYear() + " " + date1.getHours() + ":" + pad(date1.getMinutes()) + " – " + date2.getHours() + ":" + pad(date2.getMinutes())
                        + " <span class='label label-info'>Trvanie</span> " + pad(Math.floor(diff / 1000 / 60 / 60)) + ":" + pad((Math.floor(diff / 1000 / 60)) - pad(Math.floor(diff / 1000 / 60 / 60) * 60)) + ":" + (Math.floor(diff / 1000) - Math.floor(diff / 1000 / 60) * 60) + " <span class='label label-success'>Dĺžka</span> " + (Math.round(calculateDistance(processedData) / 100) / 10) + " km");
            }
            app.setData(new AppData(data));
            app.setView('map');
        };
    });

    $("#showStart").click(function () {
        app.setView('start');
    });

    $("#showMap").click(function () {
        app.setView('map');
    });

    $("#showGraph").click(function () {
        app.setView('graph');
    });

}


google.maps.event.addDomListener(window, 'load', initialize);
