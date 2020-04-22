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
'use strict';

const electron = require('electron');
const fs = require('fs');
const path = require('path');
const Utils = require('./utils.js');
const pak = require('../package.json');

// Zack's doing
function isEmpty(obj) {
  if (obj == null || obj == undefined || obj == "") return true;
  if (typeof(obj) !== "object") return false;
  if (Array.isArray(obj)) return obj.length == 0;
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) return false;
  }
  return true;
}

module.exports = class Main{
	
	modules = {};
	
	constructor(win){
		Object.defineProperty(this, 'win', {get: function() { return win; }});
		
		// Let's register our event listeners now.
		this._eventListener();
		
		// Let's read our modules now
		this._loadModules();
	}
	
	getModule(name){
		return this.modules[name] || null;
	}
	
	// Methods for private use -- don't call them from outside, please
	
	/**
	 * The hook method
	 */
	_hook(){
		this._watchdog();
	}
	
	/**
	 * This is the event listener. Every fired event gets listened here.
	 */
	_eventListener(){
		// Expose event listeners for controller plugins
		electron.ipcMain.on('glasscord_refresh', () => {
			this._log('IPC requested update', 'log');
			this._updateVariables();
		});
		// Everything else can be controlled via CSS styling
		
		// Hook when the window is loaded
		this.win.webContents.on('dom-ready', () => {
			this._hook();
		});
	}
	
	/**
	 * Method to spawn a watchdog in the Discord window
	 * This way we can watch for style changes and update everything accordingly
	 */
	_watchdog(){
		this._executeInRenderer(
			// RENDERER CODE BEGIN
			function(){
				const {ipcRenderer} = GlasscordApi.require('electron');
				ipcRenderer.send('glasscord_refresh');
				const callback = function(mutationsList, observer){
					let shouldUpdate = false;
					for(let mutation of mutationsList){
						if(mutation.target.nodeName.toLowerCase() == 'style'){ // text in style has changed!
							shouldUpdate = true;
							break;
						}

						if(mutation.addedNodes.length != 0){ // some nodes were added!
							for(let addedNode of mutation.addedNodes){
								if(addedNode.nodeName.toLowerCase() == 'style'){
									shouldUpdate = true;
									break;
								}
							}
						}

						if(shouldUpdate) break; // don't spend other time iterating

						if(mutation.removedNodes.length != 0){ // some nodes were removed!
							for(let removedNode of mutation.removedNodes){
								if(removedNode.nodeName.toLowerCase() == 'style'){
									shouldUpdate = true;
									break;
								}
							}
						}
					}

					if(shouldUpdate) ipcRenderer.send('glasscord_refresh');
				}
				const observer = new MutationObserver(callback);
				observer.observe(document.head, {childList: true, subtree: true});
			}
		);
		// RENDERER CODE END
	}
	
	_loadModules(){
		let dirFiles = fs.readdirSync(path.join(__dirname, "modules"));
		for(let file of dirFiles){
			if(file.endsWith(".js")){
				let module = require(path.join(__dirname, "modules", file));
				if(!isEmpty(module)){
					if(module.platformExclude.includes(process.platform)) continue;
					if(!isEmpty(module.platform) && !module.platform.includes(process.platform)) continue;
					if(module.appExclude.includes(this._defineApp())) continue;
					if(!isEmpty(module.app) && !module.app.includes(this._defineApp())) continue;
					
					if(!isEmpty(module.defaultConfig))
						Utils.initializeModuleConfig(module.prototype.constructor.name, module.defaultConfig, module.isCore);
					else
						Utils.initializeModuleConfig(module.prototype.constructor.name, null, module.isCore);
					
					if(!module.isCore && !Utils.isModuleEnabled(module.prototype.constructor.name)) continue;
					this.modules[module.prototype.constructor.name] = new module(this);
				}
			}
		}
		Utils.saveConfig();
	}
	
	/**
	 * This is the method that gets called whenever a variable update is requested.
	 * It is DARN IMPORTANT to keep ALL the variables up to date!
	 * This function is a void that runs async code, so keep that in mind!
	 */
	_updateVariables(){
		let promises = [];
		
		for(let moduleName in this.modules){
			if(this.modules[moduleName].cssProps && this.modules[moduleName].cssProps.length != 0){
				for(let prop of this.modules[moduleName].cssProps){
					promises.push(this._getCssProp(prop).then(value => this.modules[moduleName].update(prop, value)));
				}
			}
		}
		
		Promise.all(promises).then(res => {
			this._log("Updated!", 'log');
		});
	}
	
	/**
	 * Another handy method to log directly to DevTools
	 */
	_log(message, level = 'log'){
		this._executeInRenderer(
			// RENDERER CODE BEGIN
			function(message, level){
				console[level]('%c[Glasscord] %c' + message, 'color:#ff00ff;font-weight:bold', 'color:inherit;font-weight:normal;');
			}
			// RENDERER CODE END
		, message, level);
	}
	
	/**
	 * General method to get CSS properties from themes.
	 * Hacky but it does the job.
	 */
	_getCssProp(propName){
		return this._executeInRenderer(
			// RENDERER CODE BEGIN
			function(propName){
				let flag = getComputedStyle(document.documentElement).getPropertyValue(propName);
				if(flag) return flag.trim().replace('"','');
			}
			// RENDERER CODE END
		, propName).then(res => {
			if(res) return res;
			return null;
		});
	}
	
	// stolen from zack senpai
	_executeInRenderer(method, ...params) {
		if(method.name.length !== 0)
			method = method.toString().replace(method.name, "function").replace("function function", "function");
		else method = method.toString();
		return this.win.webContents.executeJavaScript(`(${method})(...${JSON.stringify(params)});`);
	}
	
	_defineApp(){
		const app = require(path.resolve(electron.app.getAppPath(), "package.json"));
		return app.name;
	}
	
}
