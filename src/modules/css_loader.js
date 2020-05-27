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

	onLoad(){
		this.injectionMap = {};
		
		if(!this.config.cssPath) this.config.cssPath = "";
		
		if(this.config.cssPath.length !== 0 && !path.isAbsolute(this.config.cssPath))
			this.config.cssPath = path.resolve(this.getStoragePath(), this.config.cssPath);
		
		for(let win of electron.BrowserWindow.getAllWindows())
			this.windowInit(win);
	}

	onUnload(){
		for(let webContentsID in this.injectionMap){
			let webContents = electron.webContents.fromId(parseInt(webContentsID));
			Main._executeInRenderer(webContents, this._unload);
			webContents.removeListener("dom-ready", this.injectionMap[webContentsID]);
			
			// remove from map
			delete this.injectionMap[webContentsID];
		}
	}

	windowInit(win){
		if(typeof this.injectionMap[win.webContents.id] !== "undefined") return;
		const _this = this;
		this.injectionMap[win.webContents.id] = function(){_this._event(win)};

		// check if already ready and update accordingly
		Main._executeInRenderer(win.webContents, this._getReadyState).then(ready => {
			if(ready)
				this._event(win);
			win.webContents.on("dom-ready", this.injectionMap[win.webContents.id]);
		});
	}

	_event(win){
		Main._executeInRenderer(win.webContents, this._load, this.config.cssPath);
	}

	// Renderer functions
	_load(cssPath){
		if(typeof cssPath === "undefined" || (typeof cssPath === "string" && cssPath.length === 0)) return;

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

		if(typeof window.GlasscordApi.customCss === "undefined") readFile(cssPath).then(css => {
			window.GlasscordApi.customCss = document.createElement("style");
			window.GlasscordApi.customCss.id = "glasscord-custom-css";
			document.head.appendChild(window.GlasscordApi.customCss);
			window.GlasscordApi.customCss.innerHTML = css;
			console.log("%c[Glasscord] %cCustom stylesheet loaded!", "color:#ff00ff;font-weight:bold", "color:inherit;font-weight:normal;");

			if(typeof window.GlasscordApi.cssWatcher === "undefined") {
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
	
	_unload(){
		if(window.GlasscordApi.cssWatcher) delete window.GlasscordApi.cssWatcher;
		if(window.GlasscordApi.customCss){
			document.head.removeChild(window.GlasscordApi.customCss);
			delete window.GlasscordApi.customCss;
		}
	}

	_getReadyState(){
		return document.readyState === "complete" || document.readyState === "interactive";
	}

}
