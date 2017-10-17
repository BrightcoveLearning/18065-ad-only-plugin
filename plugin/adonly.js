// adonly.js
// Provided as an example of how to load a Brightcove Player dynamically into a div and show
// a pre-roll and then unload the player. This is also called an outstream pattern.

// Public functions:
// expandAndInjectAdOnlyPlayer - expands a div and injects an ad-only player in it
// injectAdOnlyPlayer - injects an ad-only player into a given div (no animation)


// polyfills for IE
window.Promise || document.write('<script src="https://unpkg.com/es6-promise@3.2.1/dist/es6-promise.min.js"></script>');
// end polyfills

(function(window, document, videojs){
	// create a namespace for utility functions
	if (!window.bcPlayerTools) {
		window.bcPlayerTools = {};
	}

	/**
	 * expands the given div and then injects the ad-only player
     * params:
     * options: {
	 *   muted: true | false - optional, defaults to true
	 *   autoplay: true | false - optional, defaults to true
	 *   adTag: the ad tag
	 *   adsResponse: in-line VAST string - if provided it overrides the ad tag
	 *   div: the div where you want the ad player to be injected
	 *   height: the height in pixels you want to expand the div to be
	 *   animationDuration: how long in ms to take to animate the expansion of the div height
	 * }
     */
	window.bcPlayerTools.expandAndInjectAdOnlyPlayer = function(options) {
		return new Promise(function(resolve, reject) {
			var startingDivHeight = +(options.div.style.height === "" ? 0 : options.div.style.height.slice(0, -2));
			animateDivHeight({
				duration: options.animationDuration ? options.animationDuration : 0,
				newHeight: options.height ? options.height: 288,
				div: options.div
			})
			.then(function() {
				bcPlayerTools.injectAdOnlyPlayer({
					muted: options.muted,
					autoplay: options.autoplay,
					adTag: options.adTag,
					adsResponse: options.adsResponse,
					div: options.div,
					onEnded: function() {
						animateDivHeight({
							duration: options.animationDuration ? options.animationDuration : 200,
							newHeight: startingDivHeight,
							div: options.div
						});
					}
				});
			});
		});
	};

	/**
     * injectAdOnlyPlayer - injects an ad-only player into a div
     * params:
     * options: {
	 *   muted: true | false - optional, defaults to true
	 *   autoplay: true | false - optional, defaults to true
	 *   adTag: the ad tag
	 *   adsResponse: in-line VAST string - if provided it overrides the ad tag
	 *   div: the div where you want the ad player to be injected
	 *   onEnded: a function to be called when the ad is over after the player is disposed
	 * }
	 */
	 window.bcPlayerTools.injectAdOnlyPlayer = function(options) {
		// create or get the div reference
		var div = typeof options.div === 'string' ? document.getElementById(options.div) : options.div;
		// create a video element
		var videoEl = document.createElement("video");
		// set the attributes
	  	videoEl.setAttribute("style", "width:inherit;height:inherit");
	  	videoEl.setAttribute("class", "video-js");
		videoEl.setAttribute("preload", "none");
	  	videoEl.setAttribute("controls", "");
		if (options.muted !== false) {
			videoEl.setAttribute("muted", "");
		}
		if (options.playsinline !==  false) {
			videoEl.setAttribute("playsinline", "");
		}
		// inject the video element into the DOM
		div.appendChild(videoEl);
		// create a Brightcove Player
		var player = bc(videoEl);
		// mark it as an "ad-only" player - important for analytics
		player.addClass("vjs-ad-only");
		player.adonly = true;

		// initialize the IMA3 plugin
		player.ima3({
			// if the adsResponse in-line VAST is supplied just provide a dummy ad tag
			serverUrl: options.adsResponse ? "abc" : options.adTag,
			timeout: options.timeout ? options.timeout : 7000, // use a 7-second timeout
			requestMode: "onplay",
			adTechOrder: ["html5"]
		});

		// wait for IMA3 to be ready before triggering play
		player.on('ima3-ready', function() {
			// if the user has provided an in-line VAST ad server response use that instead of the ad tag
			if (options.adsResponse) {
				// re-map the requestAds function so we can intercept and change the adsRequest parameter
				player.ima3.adsLoader.__origRequestAdsFunc = player.ima3.adsLoader.requestAds;
				player.ima3.adsLoader.requestAds = function(adsRequest) {
					adsRequest.adTagUrl = null; // don't use the ad tag
					adsRequest.adsResponse = options.adsResponse; // set the in-line VAST response
					player.ima3.adsLoader.__origRequestAdsFunc(adsRequest);	// call the real requestAds function
				};
			}
			if (options.autoplay !== false) { // if autoplay is set then play
				player.play();
			}
		});

		// destroy the player after the ad plays - if the ad is blocked then
		// destroy on "playing" event
		player.on(["adend", "playing"], function() {
			player.pause(); // don't play the video ever
			setTimeout(function(){ // give IMA plugin some time to clean up and make sure all event beacons go out
				player.dispose();
				if (options.onEnded) {
					options.onEnded();
				}
			}, 200); // delay
		});
		// our "content" video is a 1-second black MP4 which never gets shown
		player.src("//d2zihajmogu5jn.cloudfront.net/tiny.mp4");

		return player;
	};

	// grows/animates the div into which the player will be loaded
	var animateDivHeight = function(options) {
		return new Promise(function(resolve, reject) {
			var steps = Math.floor(options.duration / 30) + 1;
			var startingHeight = +(options.div.style.height === "" ? 0 : options.div.style.height.slice(0, -2));
			var increment = Math.round(Math.abs(options.newHeight -  startingHeight) / steps);
			var shrinking = startingHeight > options.newHeight;
			var adjustHeight = function() {
				var currentHeight = +(options.div.style.height === "" ? 0 : options.div.style.height.slice(0, -2));
				if (!shrinking) {
					// growing
					if (currentHeight + increment >= options.newHeight) {
						options.div.style.height = options.newHeight + "px";
						resolve();
						return;
					} else {
						options.div.style.height = (currentHeight + increment) + "px";
					}
				} else {
					// shrinking
					if (currentHeight - increment <= options.newHeight) {
						options.div.style.height = options.newHeight + "px";
						resolve();
						return;
					} else {
						options.div.style.height = (currentHeight - increment) + "px";
					}
				}
				setTimeout(adjustHeight, 30);
			};
			adjustHeight();
		});
	};
})(window, document, videojs);
