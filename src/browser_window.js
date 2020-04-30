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
const Main = require('./main.js');
const Utils = require('./utils.js');

/*
 * The BrowserWindow override class
 */
class BrowserWindow extends electron.BrowserWindow {
	constructor(options) {
		if(process.platform != 'win32') options.transparent = true;
		options.backgroundColor = '#00000000';
		let _preload = null;
		if(typeof options.webPreferences.preload !== 'undefined')
			_preload = options.webPreferences.preload;
		options.webPreferences.contextIsolation = false; // enforce it
		options.webPreferences.preload = path.join(__dirname, "preload.js");
		electron.ipcMain.on('_preload', (e) => {e.returnValue = _preload;});
		Object.assign(options, Utils.getWindowProperties());
		super(options);
		new Main(this);
	}

	/**
	 * Let's stub setBackgroundColor because it's way too buggy. Use the CSS 'body' selector instead.
	 */
	setBackgroundColor(backgroundColor){
		return;
	}
}

Object.assign(BrowserWindow, electron.BrowserWindow); // Retains the original functions

module.exports = BrowserWindow;
