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

const path = require('path');

module.exports = class CSSLoader {
	constructor(main){
		this.main = main;
		this.main._log('CSS module loaded', 'log');
		this.cssPath = require('../../glasscord_config.json').cssPath || '';
		
		this.main.win.webContents.on('dom-ready', () => { this._load() });
	}

	_load(){
		this.main.win.webContents.executeJavaScript(`(function(){
			const path = window.require('path');
			const fs = window.require('fs');
			
			function readFile(path, encoding = 'utf-8') {
	            return new Promise((resolve, reject) => {
	                fs.readFile(path, encoding, (err, data) => {
	                    if (err) reject(err);
	                    else resolve(data);
	                });
	            });
	        }
	        
			const cssPath = '${this.cssPath}';

	        readFile(cssPath).then(css => {
	            if (!window.customCss) {
	                window.customCss = document.createElement('style');
	                document.head.appendChild(window.customCss);
	            }
	            window.customCss.innerHTML = css;
				console.log('%c[Glasscord] %cCustom stylesheet loaded!', 'color:#ff00ff;font-weight:bold', 'color:inherit;font-weight:normal;');

	            if (window.cssWatcher == null) {
	                window.cssWatcher = fs.watch(cssPath, { encoding: 'utf-8' },
	                eventType => {
	                    if (eventType == 'change') {
	                        readFile(cssPath).then(newCss => {
	                            window.customCss.innerHTML = newCss;
								console.log('%c[Glasscord] %cCustom stylesheet reloaded!', 'color:#ff00ff;font-weight:bold', 'color:inherit;font-weight:normal;');
	                        });
	                    }
	                });
	            }
	        }).catch(() => console.warn('%c[Glasscord] %cCustom stylesheet not found. Skipping...', 'color:#ff00ff;font-weight:bold', 'color:inherit;font-weight:normal;'));
		}())`);
	}
}
