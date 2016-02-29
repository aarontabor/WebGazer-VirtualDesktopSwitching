(function(window) {

    window.gazer = window.gazer || {};
    gazer.reg = gazer.reg || {};
    gazer.mat = gazer.mat || {};
    gazer.util = gazer.util || {};

    var ridgeParameter = Math.pow(10,-5);
    var resizeWidth = 10;
    var resizeHeight = 6;
    var dataWindow = 700;
    var trailDataWindow = 10; //TODO perhaps more? less?;

    /**
     * Performs ridge regression, according to the Weka code.
     * @param {array} y corresponds to screen coordinates (either x or y) for each of n click events
     * @param {array of arrays} X corresponds to gray pixel features (120 pixels for both eyes) for each of n clicks
     * @param {array} ridge ridge parameter
     * @return{array} regression coefficients
     */
    function ridge(y, X, k){
        var nc = X[0].length;
        var m_Coefficients = new Array(nc);
        var xt = gazer.mat.transpose(X);
        var solution = new Array();
        var success = true;
        do{
            var ss = gazer.mat.mult(xt,X);
            // Set ridge regression adjustment
            for (var i = 0; i < nc; i++) {
                ss[i][i] = ss[i][i] + k;
            }

            // Carry out the regression
            var bb = gazer.mat.mult(xt,y);
            for(var i = 0; i < nc; i++) {
                m_Coefficients[i] = bb[i][0];
            }
            try{
                var n = (m_Coefficients.length != 0 ? m_Coefficients.length/m_Coefficients.length: 0);
                if (m_Coefficients.length*n != m_Coefficients.length){
                    console.log("Array length must be a multiple of m")
                }
                solution = (ss.length == ss[0].length ? (gazer.mat.LUDecomposition(ss,bb)) : (gazer.mat.QRDecomposition(ss,bb)));

                for (var i = 0; i < nc; i++){
                    m_Coefficients[i] = solution[i][0];
                }
                success = true;
            } 
            catch (ex){
                k *= 10;
                console.log(ex);
                success = false;
            }
        } while (!success);
        return m_Coefficients;
    }


    function getEyeFeats(eyes) {
        var resizedLeft = gazer.util.resizeEye(eyes.left, resizeWidth, resizeHeight);
        var resizedright = gazer.util.resizeEye(eyes.right, resizeWidth, resizeHeight);

        var leftGray = gazer.util.grayscale(resizedLeft.data, resizedLeft.width, resizedLeft.height);
        var rightGray = gazer.util.grayscale(resizedright.data, resizedright.width, resizedright.height);

        //TODO either move objectdetect into gazer namespace or re-implement
        var histLeft = [];
        objectdetect.equalizeHistogram(leftGray, 5, histLeft);
        var histRight = [];
        objectdetect.equalizeHistogram(rightGray, 5, histRight);

        leftGrayArray = Array.prototype.slice.call(histLeft);
        rightGrayArray = Array.prototype.slice.call(histRight);

        //TODO take into account head positions
        //23 - left eye left
        //25 - left eye right
        //30 - right eye left
        //28 - right eye right
        /*var widthLeft = eyes.positions[23][0] - eyes.positions[25][0];
        var widthRight = eyes.positions[30][0] - eyes.positions[28][0];
        var widthRatio = widthLeft / widthRight;
        var widthTotal = widthLeft + widthRight;
        var headVals = [eyes.positions[23][0], eyes.positions[23][1], eyes.positions[25][0], eyes.positions[25][1],
                        eyes.positions[30][0], eyes.positions[30][1], eyes.positions[28][0], eyes.positions[28][1],
                        widthLeft, widthRight, widthRatio, widthTotal]; */
        var headVals = [];
        return leftGrayArray.concat(rightGrayArray).concat(headVals);
    }

    function getCurrentFixationIndex() {
        var index = 0;
        var recentX = this.screenXTrailArray.get(0);
        var recentY = this.screenYTrailArray.get(0);
        for (var i = this.screenXTrailArray.length - 1; i >= 0; i--) {
            var currX = this.screenXTrailArray.get(i);
            var currY = this.screenYTrailArray.get(i);
            var euclideanDistance = Math.sqrt(Math.pow((currX-recentX),2)+Math.pow((currY-recentY),2));
            if (euclideanDistance > 72){
                return i+1;
            }
        }
        return i;
    }

    gazer.reg.RidgeReg = function() {
        this.screenXClicksArray = new gazer.util.DataWindow(dataWindow);
        this.screenYClicksArray = new gazer.util.DataWindow(dataWindow);
        this.eyeFeaturesClicks = new gazer.util.DataWindow(dataWindow);

        this.screenXTrailArray = new gazer.util.DataWindow(trailDataWindow);
        this.screenYTrailArray = new gazer.util.DataWindow(trailDataWindow);
        this.eyeFeaturesTrail = new gazer.util.DataWindow(trailDataWindow);

        this.dataClicks = new gazer.util.DataWindow(dataWindow);
        this.dataTrail = new gazer.util.DataWindow(dataWindow);
    }

    gazer.reg.RidgeReg.prototype.addData = function(eyes, screenPos, type) {
        if (!eyes) {
            return;
        }
        if (eyes.left.blink || eyes.right.blink) {
            return;
        }
        if (type === 'click') {
            this.screenXClicksArray.push([screenPos[0]]);
            this.screenYClicksArray.push([screenPos[1]]);

            this.eyeFeaturesClicks.push(getEyeFeats(eyes));
            this.dataClicks.push({'eyes':eyes, 'screenPos':screenPos, 'type':type});
        } else if (type === 'move') {
            this.screenXTrailArray.push([screenPos[0]]);
            this.screenYTrailArray.push([screenPos[1]]);

            this.eyeFeaturesTrail.push(getEyeFeats(eyes));
            this.dataTrail.push({'eyes':eyes, 'screenPos':screenPos, 'type':type});
        }
       
        eyes.left.patch = Array.from(eyes.left.patch.data);
        eyes.right.patch = Array.from(eyes.right.patch.data);
    }

    gazer.reg.RidgeReg.prototype.predict = function(eyesObj) {
        if (!eyesObj || this.eyeFeaturesClicks.length == 0) {
            return null;
        }
        var screenXArray = this.screenXClicksArray.data.concat(this.screenXTrailArray.data);
        var screenYArray = this.screenYClicksArray.data.concat(this.screenYTrailArray.data);
        var eyeFeatures = this.eyeFeaturesClicks.data.concat(this.eyeFeaturesTrail.data);

        var coefficientsX = ridge(screenXArray, eyeFeatures, ridgeParameter);
        var coefficientsY = ridge(screenYArray, eyeFeatures, ridgeParameter); 	

        var eyeFeats = getEyeFeats(eyesObj);
        var predictedX = 0;
        for(var i=0; i< eyeFeats.length; i++){
            predictedX += eyeFeats[i] * coefficientsX[i];
        }
        var predictedY = 0;
        for(var i=0; i< eyeFeats.length; i++){
            predictedY += eyeFeats[i] * coefficientsY[i];
        }

        predictedX = Math.floor(predictedX);
        predictedY = Math.floor(predictedY);

        return {
            x: predictedX,
            y: predictedY
        };
    }

    gazer.reg.RidgeReg.prototype.setData = function(data) {
        for (var i = 0; i < data.length; i++) {
            //TODO this is a kludge, needs to be fixed
            data[i].eyes.left.patch = new ImageData(new Uint8ClampedArray(data[i].eyes.left.patch), data[i].eyes.left.width, data[i].eyes.left.height);
            data[i].eyes.right.patch = new ImageData(new Uint8ClampedArray(data[i].eyes.right.patch), data[i].eyes.right.width, data[i].eyes.right.height);
            this.addData(data[i].eyes, data[i].screenPos, data[i].type);
        }
    }

    gazer.reg.RidgeReg.prototype.getData = function() {
        //TODO move data storage to webgazer object level
        return this.dataClicks.data.concat(this.dataTrail.data);
    }


    gazer.reg.RidgeReg.prototype.name = 'ridge';
}(window));