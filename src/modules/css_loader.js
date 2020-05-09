/*
   Copyright 2020 AryToNeX

   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.
*/
"use strict";

const Module = require("../module.js");
const path = require("path");
const Utils = require("../utils.js");
const Main = require("../main.js");
const electron = require("electron");

module.exports = class CSSLoader extends Module {
	static defaultOn = true;
	static defaultConfig = {cssPath: ""};
	static ensureConfigFile = true;
	static appExclude = ["discord"];
	
	constructor(){
		super();
		if(!this.config.cssPath) this.config.cssPath = "";
		
		if(this.config.cssPath.length !== 0 && !path.isAbsolute(this.config.cssPath))
			this.config.cssPath = path.resolve(this.getStoragePath(), this.config.cssPath);
	}

	windowInit(win){
		win.webContents.on("dom-ready", () => { Main._executeInRenderer(win.webContents, this._load, this.config.cssPath) });
	}

	shutdown(){
		for(let webContents of electron.webContents.getAllWebContents())
			Main._executeInRenderer(webContents, this._shutdown);
	}

	// Renderer functions
	_load(cssPath){
		// We'll use our custom GlasscordApi to require modules
		const path = GlasscordApi.require("path");
		const fs = GlasscordApi.require("fs");

		function readFile(path, encoding = "utf-8") {
			return new Promise((resolve, reject) => {
					fs.readFile(path, encoding, (err, data) => {
					if (err) reject(err);
					else resolve(data);
				});
			});
		}

		readFile(cssPath).then(css => {
			if (!window.GlasscordApi.customCss) {
				window.GlasscordApi.customCss = document.createElement("style");
				document.head.appendChild(window.GlasscordApi.customCss);
			}
			window.GlasscordApi.customCss.innerHTML = css;
			console.log("%c[Glasscord] %cCustom stylesheet loaded!", "color:#ff00ff;font-weight:bold", "color:inherit;font-weight:normal;");

			if (window.GlasscordApi.cssWatcher == null) {
				window.GlasscordApi.cssWatcher = fs.watch(cssPath, { encoding: "utf-8" },
				eventType => {
					if (eventType == "change" && window.GlasscordApi.customCss) {
						readFile(cssPath).then(newCss => {
							window.GlasscordApi.customCss.innerHTML = newCss;
							console.log("%c[Glasscord] %cCustom stylesheet reloaded!", "color:#ff00ff;font-weight:bold", "color:inherit;font-weight:normal;");
						});
					}
				});
			}
		}).catch(() => console.warn("%c[Glasscord] %cCustom stylesheet not found. Skipping...", "color:#ff00ff;font-weight:bold", "color:inherit;font-weight:normal;"));
	}
	
	_shutdown(){
		if(window.GlasscordApi.cssWatcher) delete window.GlasscordApi.cssWatcher;
		if(window.GlasscordApi.customCss){
			document.head.removeChild(window.GlasscordApi.customCss);
			delete window.GlasscordApi.customCss;
		}
	}
}
