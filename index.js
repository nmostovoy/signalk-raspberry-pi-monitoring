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
const cpu_temp_command = 'sudo cat /sys/class/thermal/thermal_zone0/temp'
const cpu_util_mpstat_command = 'sudo mpstat -P ALL\|grep \\\:\|grep -v \\\%'
const mem_util_command = 'sudo free'
const sd_util_command = 'df \/\|grep -v Used\|awk \'\{print \$5\}\'\|awk \'gsub\(\"\%\"\,\"\"\)\''

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
      temp_unit: {
        title: "Temperature unit (K - Kelvin(default), C - Celsius, F - Fahrenheit)",
        type: "string",
        default: 'K'
      },
      path_cpu_temp: {
        title: "SignalK Path for CPU temperature(degrees)",
        type: "string",
        default: "environment.rpi.cpu.temperature",
      },
      path_gpu_temp: {
        title: "SignalK Path for GPU temperature(degrees)",
        type: "string",
        default: "environment.rpi.gpu.temperature",
      },
      path_cpu_util: {
        title: "SignalK Path for CPU utilisation(%) (Please install sysstat for per core monitoring)",
        type: "string",
        default: "environment.rpi.cpu.utilisation",
      },
      path_mem_util: {
        title: "SignalK Path for memory utilisation(%)",
        type: "string",
        default: "environment.rpi.memory.utilisation",
      },
      path_sd_util: {
        title: "SignalK Path for SD card utilisation(%)",
        type: "string",
        default: "environment.rpi.sd.utilisation",
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

    function updateEnv() {
      getGpuTemperature()
      getCpuTemperature()
      getCpuUtil()
      getMemUtil()
      getSdUtil()
    }

    function getGpuTemperature() {
      var processgputemp = spawn('sh', ['-c', gpu_temp_command ])

      processgputemp.stdout.on('data', (data) => {
        debug(`got gpu  ${data}`)
        var gpu_temp = Number(data.toString().split('=')[1].split('\'')[0])
        if (options.temp_unit === 'F') {
          gpu_temp = ((gpu_temp*9/5) + 32).toFixed(2)
        }
        else if (options.temp_unit === 'C') {}
        else {
          gpu_temp = gpu_temp + 273.15
        }
        debug(`gpu temp is ${gpu_temp}`)

        app.handleMessage(plugin.id, {
          updates: [
            {
              values: [ {
                path: options.path_gpu_temp,
                value: gpu_temp
              }]
            }
          ]
        })
      })

      processgputemp.on('error', (error) => {
        console.error(error.toString())
      })

      processgputemp.on('data', function (data) {
        console.error(data.toString())
      })
    }

    function getCpuTemperature() {
      var processcputemp = spawn('sh', ['-c', cpu_temp_command ])

      processcputemp.stdout.on('data', (data) => {
        debug(`got cpu  ${data}`)
        var cpu_temp = (Number(data)/1000).toFixed(2)
        if (options.temp_unit === 'F') {
          cpu_temp = ((cpu_temp*9/5) + 32).toFixed(2)
        }
        else if (options.temp_unit === 'C') {}
        else {
          cpu_temp = cpu_temp + 273.15
        }
        debug(`cpu temp is ${cpu_temp}`)

        app.handleMessage(plugin.id, {
          updates: [
            {
              values: [ {
                path: options.path_cpu_temp,
                value: cpu_temp
              }]
            }
          ]
        })
      })

      processcputemp.on('error', (error) => {
        console.error(error.toString())
      })

      processcputemp.stderr.on('data', function (data) {
        console.error(data.toString())
      })
    }

    function getCpuUtil() {
      var processcpuutilfull = spawn('sh', ['-c', cpu_util_mpstat_command ])

      processcpuutilfull.stdout.on('data', (data) => {
        debug(`got cpu utilisation  ${data}`)
        var re = /all/im
        if (data.toString().match(re)) {
          var cpu_util = data.toString().replace(/(\n|\r)+$/, '').split('\n')
          cpu_util.forEach(function(cpu_util_line){
            var spl_line = cpu_util_line.replace(/ +/g, ' ').split(' ')
            var re2 = /^[0-9]?$/
            if (spl_line[1].match(re2)){
              debug(`cpu utilisation core ${spl_line[1]} is ${spl_line[11]}`)
              var pathArray = options.path_cpu_util.toString().split('\.')
              var newPath = pathArray[0] + "."
              for (i=1; i < (pathArray.length - 1); i++) {
                newPath = newPath + pathArray[i].toString() +"."
              }
              newPath = newPath + "core." + (Number(spl_line[1])+1).toString()
              newPath = newPath + "." + pathArray[(pathArray.length-1)]
              var cpu_util_core = (100 - Number(spl_line[11])).toFixed(0)
              app.handleMessage(plugin.id, {
                updates: [
                  {
                    values: [ {
                      path: newPath,
                      value: cpu_util_core
                    }]
                  }
                ]
              })
            }
            else {
              debug(`cpu utilisation is ${spl_line[11]}`)
              cpu_util_all = (100 - Number(spl_line[11])).toFixed(0)
              app.handleMessage(plugin.id, {
                updates: [
                  {
                    values: [ {
                      path: options.path_cpu_util,
                      value: cpu_util_all
                    }]
                  }
                ]
              })
            }
          })
        }
      })

      processcpuutilfull.on('error', (error) => {
        console.error(error.toString())
      })

      processcpuutilfull.stderr.on('data', function (data) {
        console.error(data.toString())
      })
    }

    function getMemUtil() {
      var processmemutil = spawn('sh', ['-c', mem_util_command ])

      processmemutil.stdout.on('data', (data) => {
        debug(`got memory  ${data}`)
        var mem_util = data.toString().replace(/(\n|\r)+$/, '').split('\n')
        mem_util.forEach(function(mem_util_line){
          var splm_line = mem_util_line.replace(/ +/g, ' ').split(' ')
          if (splm_line[0].toString() === "Mem:"){
            var mem_util_per = (Number(splm_line[2])/Number(splm_line[1])*100).toFixed(0)
            app.handleMessage(plugin.id, {
              updates: [
                {
                  values: [ {
                    path: options.path_mem_util,
                    value: mem_util_per
                  }]
                }
              ]
            })
          }
        })
      })

      processmemutil.on('error', (error) => {
        console.error(error.toString())
      })

      processmemutil.stderr.on('data', function (data) {
        console.error(data.toString())
      })
    }

    function getSdUtil() {
      var processsdutil = spawn('sh', ['-c', sd_util_command ])

      processsdutil.stdout.on('data', (data) => {
        debug(`got sd  ${data}`)
        var sd_util = data.toString().replace(/(\n|\r)+$/, '')
        app.handleMessage(plugin.id, {
          updates: [
            {
              values: [ {
                path: options.path_sd_util,
                value: sd_util
              }]
            }
          ]
        })
      })

      processsdutil.on('error', (error) => {
        console.error(error.toString())
      })

      processsdutil.stderr.on('data', function (data) {
        console.error(data.toString())
      })
    }

    updateEnv()
    setInterval(updateEnv, options.rate * 1000)
  }

  plugin.stop = function() {
    if ( timer ) {
      clearInterval(timer)
      timer =  null
    }
  }

  return plugin
}
