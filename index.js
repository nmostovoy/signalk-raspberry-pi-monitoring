/*
 *  Copyright 2018 Nikolay Mostovoy <mostovoy.nikolay@gmail.com> 
 * ( This plugin is a modified version of signalk-raspberry-pi-temperature - Copyright 2018 Scott Bender <scott@scottbender.net> )
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0

 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const debug = require('debug')('signalk-raspberry-pi-monitoring')
const _ = require('lodash')
const spawn = require('child_process').spawn

const gpu_temp_command = 'sudo /opt/vc/bin/vcgencmd measure_temp'
const cpu_temp_command
const cpu_load_command
const mem_load_command
const sd_usage_command

module.exports = function(app) {
  var plugin = {};
  var timer

  plugin.id = "signalk-raspberry-pi-monitoring"
  plugin.name = "Raspberry PI Monitoring"
  plugin.description = "Signal K Node Server Plugin for Raspberry PI monitoring"

  plugin.schema = {
    type: "object",
    description: "The user running node server must have permission to sudo without needing a password",
    properties: {
      path: {
        title: "SignalK Path",
        type: "string",
        default: "environment.rpi.cpu.temperature",
      },
      rate: {
        title: "Sample Rate (in seconds)",
        type: 'number',
        default: 30
      }
    }
  }


  plugin.start = function(options) {
    debug("start")

    function getTemperature() {
      var process = spawn('sh', ['-c', gpu_temp_command ])

      process.stdout.on('data', (data) => {
        debug(`got ${data}`)
        var temp = Number(data.toString().split('=')[1].split('\'')[0]) + 273.15
        debug(`temp is ${temp}`)

        app.handleMessage(plugin.id, {
          updates: [
            {
              values: [ {
                path: options.path,
                value: temp
              }]
            }
          ]
        })
      })

      process.on('error', (error) => {
        console.error(error.toString())
      })

      process.stderr.on('data', function (data) {
        console.error(data.toString())
      })
    }
    getTemperature()
    setInterval(getTemperature, options.rate * 1000)
  }

  plugin.stop = function() {
    if ( timer ) {
      clearInterval(timer)
      timer =  null
    }
  }

  return plugin
}
         
