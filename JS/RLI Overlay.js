const WsSubscribers = {
    __subscribers: {},
    websocket: undefined,
    webSocketConnected: false,
    registerQueue: [],
    init: function(port, debug, debugFilters) {
        port = port || 49322;
        debug = debug || false;
        if (debug) {
            if (debugFilters !== undefined) {
                console.warn("WebSocket Debug Mode enabled with filtering. Only events not in the filter list will be dumped");
            } else {
                console.warn("WebSocket Debug Mode enabled without filters applied. All events will be dumped to console");
                console.warn("To use filters, pass in an array of 'channel:event' strings to the second parameter of the init function");
            }
        }
        WsSubscribers.webSocket = new WebSocket("ws://localhost:" + port);
        WsSubscribers.webSocket.onmessage = function (event) {
            let jEvent = JSON.parse(event.data);
            if (!jEvent.hasOwnProperty('event')) {
                return;
            }
            let eventSplit = jEvent.event.split(':');
            let channel = eventSplit[0];
            let event_event = eventSplit[1];
            if (debug) {
                if (!debugFilters) {
                    console.log(channel, event_event, jEvent);
                } else if (debugFilters && debugFilters.indexOf(jEvent.event) < 0) {
                    console.log(channel, event_event, jEvent);
                }
            }
            WsSubscribers.triggerSubscribers(channel, event_event, jEvent.data);
        };
        WsSubscribers.webSocket.onopen = function () {
            WsSubscribers.triggerSubscribers("ws", "open");
            WsSubscribers.webSocketConnected = true;
            WsSubscribers.registerQueue.forEach((r) => {
                WsSubscribers.send("wsRelay", "register", r);
            });
            WsSubscribers.registerQueue = [];
        };
        WsSubscribers.webSocket.onerror = function () {
            WsSubscribers.triggerSubscribers("ws", "error");
            WsSubscribers.webSocketConnected = false;
        };
        WsSubscribers.webSocket.onclose = function () {
            WsSubscribers.triggerSubscribers("ws", "close");
            WsSubscribers.webSocketConnected = false;
        };
    },
    /**
     * Add callbacks for when certain events are thrown
     * Execution is guaranteed to be in First In First Out order
     * @param channels
     * @param events
     * @param callback
     */
    subscribe: function(channels, events, callback) {
        if (typeof channels === "string") {
            let channel = channels;
            channels = [];
            channels.push(channel);
        }
        if (typeof events === "string") {
            let event = events;
            events = [];
            events.push(event);
        }
        channels.forEach(function(c) {
            events.forEach(function (e) {
                if (!WsSubscribers.__subscribers.hasOwnProperty(c)) {
                    WsSubscribers.__subscribers[c] = {};
                }
                if (!WsSubscribers.__subscribers[c].hasOwnProperty(e)) {
                    WsSubscribers.__subscribers[c][e] = [];
                    if (WsSubscribers.webSocketConnected) {
                        WsSubscribers.send("wsRelay", "register", `${c}:${e}`);
                    } else {
                        WsSubscribers.registerQueue.push(`${c}:${e}`);
                    }
                }
                WsSubscribers.__subscribers[c][e].push(callback);
            });
        })
    },
    clearEventCallbacks: function (channel, event) {
        if (WsSubscribers.__subscribers.hasOwnProperty(channel) && WsSubscribers.__subscribers[channel].hasOwnProperty(event)) {
            WsSubscribers.__subscribers[channel] = {};
        }
    },
    triggerSubscribers: function (channel, event, data) {
        if (WsSubscribers.__subscribers.hasOwnProperty(channel) && WsSubscribers.__subscribers[channel].hasOwnProperty(event)) {
            WsSubscribers.__subscribers[channel][event].forEach(function(callback) {
                if (callback instanceof Function) {
                    callback(data);
                }
            });
        }
    },
    send: function (channel, event, data) {
        if (typeof channel !== 'string') {
            console.error("Channel must be a string");
            return;
        }
        if (typeof event !== 'string') {
            console.error("Event must be a string");
            return;
        }
        if (channel === 'local') {
            this.triggerSubscribers(channel, event, data);
        } else {
            let cEvent = channel + ":" + event;
            WsSubscribers.webSocket.send(JSON.stringify({
                'event': cEvent,
                'data': data
            }));
        }
    }
};


$(() => {
	WsSubscribers.init(49322, true)
	WsSubscribers.subscribe("game", "update_state", (d) => {
	    var blueName = d['game']['teams'][0]['name'];
	    var orangeName = d['game']['teams'][1]['name'];
		$(".base .topScreen .ScoreMiddle .scoreMiddleUpper .blueName .blueNameText").text(blueName);
		$(".base .topScreen .ScoreMiddle .scoreMiddleUpper .blueName .blueGameScore .blueGameScoreText").text(d['game']['teams'][0]['score']);
		$(".base .topScreen .ScoreMiddle .scoreMiddleUpper .orangeName .orangeNameText").text(orangeName);
		$(".base .topScreen .ScoreMiddle .scoreMiddleUpper .orangeName .orangeGameScore .orangeGameScoreText").text(d['game']['teams'][1]['score']);

        console.log(blueName.length);
		if (blueName.length > 9 && blueName.length < 13){
		    document.getElementById('blueNameText').style.fontSize = '15px';
		}else if(blueName.length > 14){
		    document.getElementById('blueNameText').style.fontSize = '14px';
		}else{
		    document.getElementById('blueNameText').style.fontSize = '20px';
		}

		if (orangeName.length > 9 && orangeName.length < 13){
		   document.getElementById('orangeNameText').style.fontSize = '15px';
		}else if(blueName.length > 14){
            document.getElementById('orangeNameText').style.fontSize = '14px';
        }else{
            document.getElementById('orangeNameText').style.fontSize = '20px';
        }

		var timeLeft = parseInt(d['game']['time_seconds']);
		var m = Math.floor(timeLeft/60);
		var s = (timeLeft - (m*60));
		if(s.toString().length < 2){
		s = "0" + s;
		}
		var TimeLeft = m + ":" + s;
		if(d['game']['isOT'] == "true"){
		TimeLeft = "+" + TimeLeft;
		}
		$(".base .topScreen .ScoreMiddle .scoreMiddleLower .timeTextRight").text(TimeLeft);

		var target = d['game']['target'];
		if(target != "" && d['game']['isReplay'] == false){
		  document.getElementById('playerCard').style.visibility = 'visible';
		}else{
		  document.getElementById('playerCard').style.visibility = 'hidden';
		}

		let playerName = document.getElementById("playerName");
		let playerStats = document.getElementById("playerStats");
		let playerBoost = document.getElementById("playerBoost");

		Object.keys(d['players']).forEach((id) => {

           if (d['players'][id].id == d['game']['target']) {

           if(d['players'][id].team == 0){
              playerName.style.backgroundColor = "#003EB3";
              playerStats.style.backgroundColor = "#0074F0";
           }else if(d['players'][id].team == 1){
              playerName.style.backgroundColor = "rgb(255,85,4)";
              playerStats.style.backgroundColor = "rgb(255,105,4)";
           }

            $(".base .bottomScreen .playerCard .playerName .playerNameOuter .playerNameInner").text(d['players'][id].name);
            $(".base .bottomScreen .playerCard .playerStats .playerGoals .playerGoalsAmount").text(d['players'][id].goals);
            $(".base .bottomScreen .playerCard .playerStats .playerShots .playerShotsAmount").text(d['players'][id].shots);
            $(".base .bottomScreen .playerCard .playerStats .playerAssists .playerAssistsAmount").text(d['players'][id].assists);
            $(".base .bottomScreen .playerCard .playerStats .playerSaves .playerSavesAmount").text(d['players'][id].saves);
            $(".base .bottomScreen .playerCard .playerBoost .playerBoostAmount").text(d['players'][id].boost);
            var gradientAmount = "linear-gradient(to right, orange " + d['players'][id].boost + "% , #595959 0% 100%)";
            playerBoost.style.background = gradientAmount;
          }
        });
	});

	WsSubscribers.subscribe("game", "replay_start", (e) => {
	    document.getElementById('playerCard').style.visibility = 'hidden';
	});
	var blueCount = 0;
	var orangeCount = 0;
	WsSubscribers.subscribe("series", "bo3", (e) => {
	    blueCount = 1;
	    document.getElementById('BlueText1').style.color = "var(--dl-color-gray-500)";
	    document.getElementById('BlueText2').style.color = "var(--dl-color-gray-500)";
	    document.getElementById('BlueText3').style.color = "var(--dl-color-gray-500)";
        document.getElementById('BlueText4').style.color = "var(--dl-color-gray-500)";
	    orangeCount = 1;
	    document.getElementById('OrangeText1').style.color = "var(--dl-color-gray-500)";
	    document.getElementById('OrangeText2').style.color = "var(--dl-color-gray-500)";
	    document.getElementById('OrangeText3').style.color = "var(--dl-color-gray-500)";
	    document.getElementById('OrangeText4').style.color = "var(--dl-color-gray-500)";
	    $(".base .topScreen .SeriesScore .SeriesScoreLower .SeriesScoreText").text("Bo3");
	    document.getElementById('SeriesScore').style.visibility = 'visible';
	    document.getElementById('BlueText1').style.visibility = 'hidden';
	    document.getElementById('BlueText2').style.visibility = 'visible';
	    document.getElementById('BlueText3').style.visibility = 'visible';
	    document.getElementById('BlueText4').style.visibility = 'hidden';
	    document.getElementById('OrangeText1').style.visibility = 'hidden';
	    document.getElementById('OrangeText2').style.visibility = 'visible';
	    document.getElementById('OrangeText3').style.visibility = 'visible';
	    document.getElementById('OrangeText4').style.visibility = 'hidden';
	});
	WsSubscribers.subscribe("series", "bo5", (e) => {
	    blueCount = 0;
	    document.getElementById('BlueText1').style.color = "var(--dl-color-gray-500)";
	    document.getElementById('BlueText2').style.color = "var(--dl-color-gray-500)";
	    document.getElementById('BlueText3').style.color = "var(--dl-color-gray-500)";
        document.getElementById('BlueText4').style.color = "var(--dl-color-gray-500)";
	    orangeCount = 0;
	    document.getElementById('OrangeText1').style.color = "var(--dl-color-gray-500)";
	    document.getElementById('OrangeText2').style.color = "var(--dl-color-gray-500)";
	    document.getElementById('OrangeText3').style.color = "var(--dl-color-gray-500)";
	    document.getElementById('OrangeText4').style.color = "var(--dl-color-gray-500)";
	    $(".base .topScreen .SeriesScore .SeriesScoreLower .SeriesScoreText").text("Bo5");
	    document.getElementById('SeriesScore').style.visibility = 'visible';
	    document.getElementById('BlueText1').style.visibility = 'visible';
	    document.getElementById('BlueText2').style.visibility = 'visible';
	    document.getElementById('BlueText3').style.visibility = 'visible';
	    document.getElementById('BlueText4').style.visibility = 'hidden';
	    document.getElementById('OrangeText1').style.visibility = 'visible';
	    document.getElementById('OrangeText2').style.visibility = 'visible';
	    document.getElementById('OrangeText3').style.visibility = 'visible';
	    document.getElementById('OrangeText4').style.visibility = 'hidden';
	});
	WsSubscribers.subscribe("series", "bo7", (e) => {
	    blueCount = 0;
	    document.getElementById('BlueText1').style.color = "var(--dl-color-gray-500)";
	    document.getElementById('BlueText2').style.color = "var(--dl-color-gray-500)";
	    document.getElementById('BlueText3').style.color = "var(--dl-color-gray-500)";
        document.getElementById('BlueText4').style.color = "var(--dl-color-gray-500)";
	    orangeCount = 0;
	    document.getElementById('OrangeText1').style.color = "var(--dl-color-gray-500)";
	    document.getElementById('OrangeText2').style.color = "var(--dl-color-gray-500)";
	    document.getElementById('OrangeText3').style.color = "var(--dl-color-gray-500)";
	    document.getElementById('OrangeText4').style.color = "var(--dl-color-gray-500)";
	    $(".base .topScreen .SeriesScore .SeriesScoreLower .SeriesScoreText").text("Bo7");
	    document.getElementById('SeriesScore').style.visibility = 'visible';
	    document.getElementById('BlueText1').style.visibility = 'visible';
	    document.getElementById('BlueText2').style.visibility = 'visible';
	    document.getElementById('BlueText3').style.visibility = 'visible';
	    document.getElementById('BlueText4').style.visibility = 'visible';
	    document.getElementById('OrangeText1').style.visibility = 'visible';
	    document.getElementById('OrangeText2').style.visibility = 'visible';
	    document.getElementById('OrangeText3').style.visibility = 'visible';
	    document.getElementById('OrangeText4').style.visibility = 'visible';
	});
	WsSubscribers.subscribe("series", "noBoSeries", (e) => {
	    blueCount = 0;
	    document.getElementById('BlueText1').style.color = "var(--dl-color-gray-500)";
	    document.getElementById('BlueText2').style.color = "var(--dl-color-gray-500)";
	    document.getElementById('BlueText3').style.color = "var(--dl-color-gray-500)";
        document.getElementById('BlueText4').style.color = "var(--dl-color-gray-500)";
	    orangeCount = 0;
	    document.getElementById('OrangeText1').style.color = "var(--dl-color-gray-500)";
	    document.getElementById('OrangeText2').style.color = "var(--dl-color-gray-500)";
	    document.getElementById('OrangeText3').style.color = "var(--dl-color-gray-500)";
	    document.getElementById('OrangeText4').style.color = "var(--dl-color-gray-500)";
	    document.getElementById('SeriesScore').style.visibility = 'hidden';
	    document.getElementById('BlueText1').style.visibility = 'hidden';
	    document.getElementById('BlueText2').style.visibility = 'hidden';
	    document.getElementById('BlueText3').style.visibility = 'hidden';
	    document.getElementById('BlueText4').style.visibility = 'hidden';
	    document.getElementById('OrangeText1').style.visibility = 'hidden';
	    document.getElementById('OrangeText2').style.visibility = 'hidden';
	    document.getElementById('OrangeText3').style.visibility = 'hidden';
	    document.getElementById('OrangeText4').style.visibility = 'hidden';
	});
	WsSubscribers.subscribe("series", "BluePlus", (e) => {
	    var blue1 = document.getElementById('BlueText1');
	    var blue2 = document.getElementById('BlueText2');
	    var blue3 = document.getElementById('BlueText3');
	    var blue4 = document.getElementById('BlueText4');
	    if(blueCount == 0){
	      blue1.style.color = "orange";
	      blueCount = 1;
	    }else if(blueCount == 1){
	      blue2.style.color = "orange";
	      blueCount = 2;
	    }else if(blueCount == 2){
	      blue3.style.color = "orange";
	      blueCount = 3;
	    }else if(blueCount == 3){
	      blue4.style.color = "orange";
	      blueCount = 4;
	    }
	});
	WsSubscribers.subscribe("series", "BlueMinus", (e) => {
	    var blue1 = document.getElementById('BlueText1');
	    var blue2 = document.getElementById('BlueText2');
	    var blue3 = document.getElementById('BlueText3');
	    var blue4 = document.getElementById('BlueText4');
	    if(blueCount == 4){
	      blue4.style.color = "var(--dl-color-gray-500)";
	      blueCount = 3;
	    }else if(blueCount == 3){
	      blue3.style.color = "var(--dl-color-gray-500)";
	      blueCount = 2;
	    }else if(blueCount == 2){
	      blue2.style.color = "var(--dl-color-gray-500)";
	      blueCount = 1;
	    }else if(blueCount == 1){
	      blue1.style.color = "var(--dl-color-gray-500)";
	      blueCount = 0;
	    }
	});
	WsSubscribers.subscribe("series", "OrangePlus", (e) => {
	    var Orange1 = document.getElementById('OrangeText1');
	    var Orange2 = document.getElementById('OrangeText2');
	    var Orange3 = document.getElementById('OrangeText3');
	    var Orange4 = document.getElementById('OrangeText4');
	    if(orangeCount == 0){
	      Orange1.style.color = "orange";
	      orangeCount = 1;
	    }else if(orangeCount == 1){
	      Orange2.style.color = "orange";
	      orangeCount = 2;
	    }else if(orangeCount == 2){
	      Orange3.style.color = "orange";
	      orangeCount = 3;
	    }else if(orangeCount == 3){
	      Orange4.style.color = "orange";
	      orangeCount = 4;
	    }
	});
	WsSubscribers.subscribe("series", "OrangeMinus", (e) => {
	    var Orange1 = document.getElementById('OrangeText1');
	    var Orange2 = document.getElementById('OrangeText2');
	    var Orange3 = document.getElementById('OrangeText3');
	    var Orange4 = document.getElementById('OrangeText4');
	    if(orangeCount == 4){
	      Orange4.style.color = "var(--dl-color-gray-500)";
	      orangeCount = 3;
	    }else if(orangeCount == 3){
	      Orange3.style.color = "var(--dl-color-gray-500)";
	      orangeCount = 2;
	    }else if(orangeCount == 2){
	      Orange2.style.color = "var(--dl-color-gray-500)";
	      orangeCount = 1;
	    }else if(orangeCount == 1){
	      Orange1.style.color = "var(--dl-color-gray-500)";
	      orangeCount = 0;
	    }
	});

	WsSubscribers.subscribe("game", "goal_scored", (e) => {
	  $(".base .bottomScreen .replayCard .replayUpper .replayNameOuter .replayNameInner").text(e['scorer']['name']);
	  playerName = document.getElementById('replayUpper');
	  playerStats = document.getElementById('replayLower');
	  if(e['scorer']['teamnum'] == 0){
          playerName.style.backgroundColor = "#003EB3";
          playerStats.style.backgroundColor = "#0074F0";
       }else if(e['scorer']['teamnum'] == 1){
          playerName.style.backgroundColor = "rgb(255,85,4)";
          playerStats.style.backgroundColor = "rgb(255,105,4)";
       }
      if(e['assister']['name'] == ""){
        $(".base .bottomScreen .replayCard .replayLower .replayAssister .replayAssisterName").text("None");
      }else{

        $(".base .bottomScreen .replayCard .replayLower .replayAssister .replayAssisterName").text(e['assister']['name']);
      }
      var goalSpeed = Math.round(e['goalspeed']) + " KM/H";
      console.log(goalSpeed);
      $(".base .bottomScreen .replayCard .replayLower .replayGoalSpeed .replaySpeedAmount").text(goalSpeed);
      console.log(e);
	});

	WsSubscribers.subscribe("game", "replay_start", (e) => {
	  document.getElementById('replayStats').style.visibility = 'visible';
	});

	WsSubscribers.subscribe("game", "replay_end", (e) => {
	  document.getElementById('replayStats').style.visibility = 'hidden';
	});
});