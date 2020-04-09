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
const path = require('path');
const _glasscord_version = '0.0.5'; // TODO: find a more stylish way to define the version

if(process.platform == 'win32'){
	try{
		var ewc = process.arch == 'x64' ? require('./ewc64.asar') : require('./ewc.asar');
	} catch (e) {
		electron.dialog.showMessageBoxSync({
			type: 'error',
			title: 'Glasscord',
			message: 'The EWC dependency is either missing, corrupt or not placed in the correct folder!',
			buttons: ['Alexa, play Despacito']
		});
		process.exit(1);
	}
}
/**
 * Debounce function
 * Might come in handy, given all those bouncy events!
 */
function debounce(func, wait, immediate){
	var timeout;
	return function() {
		var context = this, args = arguments;
		var callNow = immediate && !timeout;
		clearTimeout(timeout);
		timeout = setTimeout(function() {
			timeout = null;
			if (!immediate) func.apply(context, args);
		}, wait);
		if (callNow) func.apply(context, args);
	};
}

class Glasscord{
	
	constructor(win){
		Object.defineProperty(this, 'win', {get: function() { return win; }});
		if(process.platform == 'win32'){ // Windows-only properties
			this._win32_type = 'none';
			this._win32_performance_mode = true;
		}
		
		if(process.platform == 'linux'){ // Linux-only properties
			this._linux_blur = false;
		}
		
		if(process.platform == 'darwin'){ // Mac-only properites
			this._macos_vibrancy = null;
		}
		
		// Let's register our event listeners now.
		this._eventListener();
	}
	
	/**
	 * This method updates Glasscord's perks according to the current properties
	 */
	update(){
		if(process.platform == 'win32'){
			this._win32(this._win32_type);
			return;
		}
		
		if(process.platform == 'linux')
			this._linux_requestBlur(this._linux_blur);
		
		if(process.platform == 'darwin')
			this.setVibrancy(this._macos_vibrancy);
		
		this._log("Updated!", 'log');
	}
	
	// Methods for private use -- don't call them from outside, please
	
	/**
	 * Glasscord's hook method
	 */
	_hook(){
		this._defineGlasscordProperty();
		this._watchdog();
	}
	
	/**
	 * This is Glasscord's event listener. Every fired event gets listened here.
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
		
		// Windows' performance mode toggle
		if(process.platform == 'win32'){
			const lessCostlyBlurWin = debounce(() => {this._win32('blurbehind')}, 50, true);
			const moreCostlyBlurWin = debounce(() => {this._win32('acrylic')}, 50);
			this.win.on('move', () => {
				if(this._win32_type == 'acrylic' && this._win32_performance_mode){
					lessCostlyBlurWin();
					moreCostlyBlurWin();
				}
			});
			this.win.on('resize', () => {
				if(this._win32_type == 'acrylic' && this._win32_performance_mode){
					lessCostlyBlurWin();
					moreCostlyBlurWin();
				}
			});
		}
	}
	
	/**
	 * Method to spawn a watchdog in the Discord window
	 * This way we can watch for style changes and update Glasscord accordingly
	 */
	_watchdog(){
		this.win.webContents.executeJavaScript(`(function(){
			const callback = function(mutationsList, observer){
				let shouldUpdateGlasscord = false;
				for(let mutation of mutationsList){
					if(mutation.target.nodeName.toLowerCase() == 'style'){ // text in style has changed!
							shouldUpdateGlasscord = true;
							break;
					}
					
					if(mutation.addedNodes.length != 0){ // some nodes were added!
						for(let addedNode of mutation.addedNodes){
							if(addedNode.nodeName.toLowerCase() == 'style'){
								shouldUpdateGlasscord = true;
								break;
							}
						}
					}
					
					if(shouldUpdateGlasscord) break; // don't spend other time iterating
				
					if(mutation.removedNodes.length != 0){ // some nodes were removed!
						for(let removedNode of mutation.removedNodes){
							if(removedNode.nodeName.toLowerCase() == 'style'){
								shouldUpdateGlasscord = true;
								break;
							}
						}
					}
				}
			
				if(shouldUpdateGlasscord){
					window.require('electron').ipcRenderer.send('glasscord_refresh');
				}
			}
			const observer = new MutationObserver(callback);
			observer.observe(document.head, {childList: true, subtree: true});
		}())`);
	}
	
	/**
	 * This is the method that gets called whenever a variable update is requested.
	 * It is DARN IMPORTANT to keep ALL the variables up to date!
	 * This function is a void that runs async code, so keep that in mind!
	 * Also, keep in mind it calls enable() or disable() at its end!
	 */
	_updateVariables(){
		let promises = [];
		
		if(process.platform == 'win32'){
			promises.push(this._getCssProp('--glasscord-win-blur').then(blurType => {
				if(blurType != null){
					this._win32_type = blurType;
					return;
				}
				this._win32_type = 'none';
			}));
		
			promises.push(this._getCssProp('--glasscord-win-performance-mode').then(mode => {
				if(mode){
					switch(mode){
						case "true":
						default:
							this._win32_performance_mode = true;
							break;
						case "false":
							this._win32_performance_mode = false;
							break; 
						}
					return;
				}
				this._win32_performance_mode = true;
			}));
		}
		
		if(process.platform == 'darwin'){
			promises.push(this._getCssProp('--glasscord-macos-vibrancy').then(vibrancy => {
				if(vibrancy != null){
					if(vibrancy == "none") this._macos_vibrancy = null;
					else this._macos_vibrancy = vibrancy;
					return;
				}
				this._macos_vibrancy = null;
			}));
		}
		
		if(process.platform == 'linux'){
			promises.push(this._getCssProp('--glasscord-linux-blur').then(mode => {
				if(mode){
					switch(mode){
						case "true":
						default:
							this._linux_blur = true;
							break;
						case "false":
							this._linux_blur = false;
							break; 
					}
					return;
				}
				this._linux_blur = false;
			}));
		}
		
		Promise.all(promises).then(res => {
			this.update();
		});
	}
	
	/**
	 * This method handles blur and transparency on Windows.
	 * There's nothing special about it, really.
	 */
	_win32(type){
		switch(type){
			case 'acrylic':
				ewc.setAcrylic(this.win, 0x01000000);
				break;
			case 'blurbehind':
				ewc.setBlurBehind(this.win, 0x00000000);
				break;
			case 'transparent':
				ewc.setTransparentGradient(this.win, 0x00000000);
				break;
			case 'none':
			default:
				ewc.disable(this.win, 0xff000000);
				break;
		}
	}
	
	_linux_requestBlur(mode){
		if(mode && process.env.XDG_SESSION_TYPE != 'x11'){
			this._log("You are not on an X11 session, therefore Glasscord can\'t request the frosted glass effect!", 'log');
			return;
		}
		
		if(process.env.XDG_SESSION_TYPE == 'x11'){
			let execFile = require('child_process').execFile;
			let xprop;
			execFile('which', ['xprop'], (error,stdout,stderr) => {
				if(error){
					this._log("Your system is missing the xprop tool (perhaps we're in a Snap/Flatpak container?). Please make it available to Discord to be able to request the frosted glass effect!", 'log');
					return;
				}
				xprop = stdout.trim();
				
				const shCommand = `${xprop} -id $(xprop -root -notype | awk '$1=="_NET_SUPPORTING_WM_CHECK:"\{print $5\}') -notype -f _NET_WM_NAME 8t | grep "_NET_WM_NAME = " | cut --delimiter=' ' --fields=3 | cut --delimiter='"' --fields=2`;
				execFile('sh', ['-c',shCommand], (error,stdout,stderr) => {
					if(error) return;
					switch(stdout.trim()){
						case 'KWin':
							this._linux_kwin_requestBlur(mode);
							break;
						default:
							if(mode)
								this._log("You are not running a supported window manager. Blur won't be available via Glasscord.", 'log');
							break;
					}
				});
			});
		}
	}
	
	/**
	 * This method handles blurring on KWin
	 * Sorry, Wayland users (for now) :C
	 */
	_linux_kwin_requestBlur(mode){
		if(process.env.XDG_SESSION_TYPE != 'x11') return;
		
		const xid = this.win.getNativeWindowHandle().readUInt32LE().toString(16);
		const remove = 'xprop -f _KDE_NET_WM_BLUR_BEHIND_REGION 32c -remove _KDE_NET_WM_BLUR_BEHIND_REGION -id 0x' + xid;
		const request = 'xprop -f _KDE_NET_WM_BLUR_BEHIND_REGION 32c -set _KDE_NET_WM_BLUR_BEHIND_REGION 0 -id 0x' + xid;
		
		let sys = require('sys')
		let exec = require('child_process').exec;
		exec(mode ? request : remove);
	}
	
	/**
	 * Handy method to expose this object to the window.
	 * It is basically a shorthand for require('electron').remote. yadda yadda
	 */
	_exposeToDevTools(){
		this.win.webContents.executeJavaScript("window.glasscord = window.require('electron').remote.getCurrentWindow().glasscord;");
	}
	
	_defineGlasscordProperty(){
		this.win.webContents.executeJavaScript(`window.glasscord = '${_glasscord_version}';`);
	}
	
	/**
	 * Another handy method to log directly to DevTools
	 */
	_log(message, level){
		this.win.webContents.executeJavaScript("console." + level + "('%c[Glasscord] %c" + message + "', 'color:#ff00ff;font-weight:bold', 'color:initial;font-weight:normal;');");
	}
	
	/**
	 * Useful method to dump what Glasscord is storing.
	 */
	_dumpvars(){
		let dumpMessage = "Properties: " + JSON.stringify(
			{
				win32_type: this._win32_type || null,
				win32_performance_mode: this._win32_performance_mode || null,
				linux_blur: this._linux_blur || null,
				macos_vibrancy: this._macos_vibrancy || null
			}
		);
		this._log(dumpMessage, 'log');
	}
	
	/**
	 * General method to get CSS properties from themes.
	 * Hacky but it does the job.
	 */
	_getCssProp(propName){
		return this.win.webContents.executeJavaScript(`(function(){
			let flag = getComputedStyle(document.documentElement).getPropertyValue('${propName}');
			if(flag)
				return flag.trim().replace('"','');
		}())`).then(res => {
			if(res) return res;
			return null;
		});
	}
}

/*
 * The BrowserWindow override class
 * This is the core of Glasscord.
 */
class BrowserWindow extends electron.BrowserWindow {
	constructor(originalOptions) {
		if(process.platform != 'win32') originalOptions.transparent = true;
		originalOptions.backgroundColor = '#00000000'; 
		super(originalOptions);
		new Glasscord(this);
	}

	/**
	 * Let's stub setBackgroundColor because it's way too buggy. Use the CSS 'body' selector instead.
	 */
	setBackgroundColor(backgroundColor){
		return;
	}
}

// from EnhancedDiscord -- thanks folks!
const electron_path = require.resolve('electron');
Object.assign(BrowserWindow, electron.BrowserWindow); // Assigns the new chrome-specific ones
if (electron.deprecate && electron.deprecate.promisify) {
	const originalDeprecate = electron.deprecate.promisify; // Grab original deprecate promisify
	electron.deprecate.promisify = (originalFunction) => originalFunction ? originalDeprecate(originalFunction) : () => void 0; // Override with falsey check
}
const newElectron = Object.assign({}, electron, {BrowserWindow});
delete require.cache[electron_path].exports;
require.cache[electron_path].exports = newElectron;
