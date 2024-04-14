'use strict';

const v3 = require('node-hue-api').v3,
    discovery = require('node-hue-api').discovery,
    hueApi = require('node-hue-api').api,
    ApiError = require('node-hue-api').ApiError,
    LightState = require('node-hue-api').v3.lightStates.LightState,
    config = require('./config/config'),
    nconf = require('nconf'),
    retry = require('async-await-retry'),
    FetchError = require('node-fetch').FetchError,
    fetch = require('node-fetch');

nconf.argv()
    .env()
    .file({ file: 'config/config.json' });

async function discoverBridge() {
    try {
        const bridges = await discovery.nupnpSearch();
        if (bridges.length === 0) {
            throw new Error("No Hue Bridges were detected in the network");
         }
         return bridges[0]; // Support to multiple bridges might come in the future if requested
    } catch (err) {
        console.error(`Failure with n-UPnP search: ${err.message}`)
        process.exit(-1);
    }
}

async function registerBridge() {
    const bridge = await discoverBridge();
    const unauthenticatedApi = await hueApi.createLocal(bridge.ipaddress).connect();

    try {
        let user = await retry(async () => { return unauthenticatedApi.users.createUser(config.appName, config.deviceName) }, null, {retriesMax: 30, interval: 1000, exponential: false,
            onAttemptFail: async (data) => {
                if(data.error instanceof ApiError && data.error.getHueErrorType() === 101) {
                    let counter = data.currentRetry+1;
                    process.stdout.write('Please, press the Hue button to allow the connection. Attempt ' + counter + ' of 30.\r');
                    await sleep(1000);
                    return true;
                } else {
                    throw data.error;
                }
            }
        });

        nconf.set('bridge:ipaddress', bridge.ipaddress);
        nconf.set('bridge:username', user.username);
        nconf.set('bridge:clientkey', user.clientkey);

        console.log('Client correctly registered to Hue Bridge!');

        nconf.save();
        startup();
    } catch(err) {
        if (err instanceof ApiError) {
            if (err.getHueErrorType() === 101) {
                console.error('The Link button on the bridge was not pressed. Please press the Link button and try again.');
            } else {
                console.error(`Unexpected Hue Error: ${err.message}`);
            }
        } else {
            console.error(`Unexpected Error: ${err.message}`);
        }
        process.exit(-1);
    }
}

function sleep(millis) {
    return new Promise(resolve => setTimeout(resolve, millis));
}
var hueapi;
async function startup() {
    if (nconf.get('bridge')) {
        try {
            hueapi = await hueApi.createLocal(nconf.get('bridge:ipaddress')).connect(nconf.get('bridge:username'));
        } catch (err) {
            if (err instanceof FetchError) {
                console.error('No bridge was detected on ' + nconf.get('bridge:ipaddress') +', trying to detect it again...');
                const bridge = await discoverBridge();
                try {
                    hueapi = await hueApi.createLocal(bridge.ipaddress).connect(nconf.get('bridge:username'));
                } catch (err) {
                    console.error('Unexpected error, please check your network. Error details: ' + err.message);
                    process.exit(-1);
                }
                nconf.set('bridge:ipaddress', bridge.ipaddress);
                nconf.save();
                console.log('New ip for bridge detected: '+bridge.ipaddress);

            } else {
                console.error('Unexpected error: ' + err.message);
                process.exit(-1);
            }
        }
        const allLights = await hueapi.lights.getAll();
        await Promise.all(allLights.map(async (light) => {
            if(light.state.hue) {
                console.log(light.id + ': Hue ' + light.state.hue + ' - light.state.xy: ' + light.state.xy);
            }
            return;
        }));

        /*await activarModo(suave);
        await sleep(5000);
        await activarModo(lucesfull);*/
        //await activarModo(lucesfull);
        //await sleep(5000);
        /*for (let country in COUNTRIES) {
            if (COUNTRIES[country]) {
                await activarModo(COUNTRIES[country]);
                await activarModo(suave);
                await sleep(2000);
            }
        }
        /*await Promise.all(initialState.map(async (light) => {
            hueapi.lights.setLightState(light.id, light.state);
            return;
        }));*/

        while(true) {
            fetchLoop();
            await sleep(5000);
        }

        //await fetchLoop();

    } else {
        console.log('There is no previous bridge configuration, auto-discovering bridge...');
        await registerBridge();
    }
}

var currentCountry;
const FIVE_MIN=5*60*1000;


async function fetchLoop() {
    await fetch(config.blogurl, { method: "Get" })
        .then(res => res.json())
        .then((json) => {
            for(let snippet in json.snippets) {
                if (new Date() - new Date(json.snippets[snippet].published_at) < FIVE_MIN) {
                    for (let country in COUNTRIES) {
                        if (json.snippets[snippet].title.includes('#OpenUp') && json.snippets[snippet].title.includes(country)) {
                            if(currentCountry==country) {
                                return;
                            }
                            console.log('Nuevo pais! ' + country);
                            currentCountry = country;
                            activarModo(COUNTRIES[country]);
                            activarModo(suave);
                            return;
                        }
                    }
                    console.log('Headline not related: ' + json.snippets[snippet].title);
                } else {
                    console.log('Old headline: ' + json.snippets[snippet].title);
                    activarModo(lucesfull);
                }
                // Ups, vuelta a luces normales
                //console.log('No hay actuaciones, vuelta a luces normales');

            }
        });

}

const suave = [
    {id: 1, state: new LightState().on().ct(447).brightness(50) },
    {id: 3, state: new LightState().on().ct(447).brightness(50) },
    {id: 4, state: new LightState().on().ct(447).brightness(50) },
    {id: 5, state: new LightState().on().ct(447).brightness(50) },
    {id: 22, state: new LightState().on().ct(447).brightness(50) },
    {id: 23, state: new LightState().on().ct(447).brightness(50) },
    {id: 24, state: new LightState().on().ct(447).brightness(50) },
    {id: 25, state: new LightState().on().ct(447).brightness(50) },
    {id: 26, state: new LightState().on().ct(447).brightness(50) },
    {id: 27, state: new LightState().on().ct(447).brightness(50) },
    {id: 31, state: new LightState().on().ct(447).brightness(50) }
];

const lucesfull = [
    {id: 1, state: new LightState().on().ct(447).brightness(100) },
    {id: 3, state: new LightState().on().ct(447).brightness(100) },
    {id: 4, state: new LightState().on().ct(447).brightness(100) },
    {id: 5, state: new LightState().on().ct(447).brightness(100) },
    {id: 22, state: new LightState().on().ct(447).brightness(100) },
    {id: 23, state: new LightState().on().ct(447).brightness(100) },
    {id: 24, state: new LightState().on().ct(447).brightness(100) },
    {id: 25, state: new LightState().on().ct(447).brightness(100) },
    {id: 26, state: new LightState().on().ct(447).brightness(100) },
    {id: 27, state: new LightState().on().ct(447).brightness(100) },
    {id: 31, state: new LightState().on().ct(447).brightness(100) },
    {id: 13, state: new LightState().on().ct(447).brightness(100) },
    {id: 14, state: new LightState().on().ct(447).brightness(100) },
    {id: 16, state: new LightState().on().ct(447).brightness(100) },
    {id: 17, state: new LightState().on().ct(447).brightness(100) },
    {id: 18, state: new LightState().on().ct(447).brightness(100) },
    {id: 20, state: new LightState().on().ct(447).brightness(100) },
    {id: 21, state: new LightState().on().ct(447).brightness(100) }
];



async function activarModo(modo) {
    await Promise.all(modo.map(async (light) => {
        hueapi.lights.setLightState(light.id, light.state);
        return;
    }));
}

startup();

const cyprusflag = [
    // Esc izq
    {id: 13, state: new LightState().on().rgb(234,150,28).brightness(100) },
    // Esc der
    {id: 14, state: new LightState().on().rgb(234,150,28).brightness(100) },
    // Salon der
    {id: 16, state: new LightState().on().rgb(234,150,28).brightness(100) },
    // Salon izq
    {id: 17, state: new LightState().on().rgb(234,150,28).brightness(100) },
    // Escritorio
    {id: 18, state: new LightState().on().rgb(0,105,78).brightness(100) },
    // Tira leds
    {id: 20, state: new LightState().on().hue(31298).brightness(100) },
    // Lamparilla
    {id: 21, state: new LightState().on().rgb(0,105,78).brightness(100) }
];

const albaniaflag = [
    // Esc izq
    {id: 13, state: new LightState().on().rgb(218, 41, 28).brightness(100) },
    // Esc der
    {id: 14, state: new LightState().on().rgb(218, 41, 28).brightness(100) },
    // Salon der
    {id: 16, state: new LightState().on().rgb(218, 41, 28).brightness(100) },
    // Salon izq
    {id: 17, state: new LightState().on().rgb(218, 41, 28).brightness(100) },
    // Escritorio
    {id: 18, state: new LightState().on().rgb(218, 41, 28).brightness(100) },
    // Tira leds
    {id: 20, state: new LightState().on().xy(0.6825,0.2911).brightness(100) },
    // Lamparilla
    {id: 21, state: new LightState().on().rgb(218, 41, 28).brightness(100) }
];

const israelflag = [
    // Esc izq
    {id: 13, state: new LightState().on().rgb(0,94,184).brightness(100) },
    // Esc der
    {id: 14, state: new LightState().on().rgb(0,94,184).brightness(100) },
    // Salon der
    {id: 16, state: new LightState().on().rgb(0,94,184).brightness(100) },
    // Salon izq
    {id: 17, state: new LightState().on().rgb(0,94,184).brightness(100) },
    // Escritorio
    {id: 18, state: new LightState().on().rgb(0,94,184).brightness(100) },
    // Tira leds
    {id: 20, state: new LightState().on().xy(0.141,0.1451).brightness(100) },
    //{id: 20, state: new LightState().off() },
    // Lamparilla
    {id: 21, state: new LightState().on().rgb(0,94,184).brightness(100) }
];

const belgiumflag = [
    // Esc izq
    {id: 13, state: new LightState().on().rgb(253, 218, 36).brightness(100) },
    // Esc der
    {id: 14, state: new LightState().on().rgb(253, 218, 36).brightness(100) },
    // Salon der
    {id: 16, state: new LightState().on().rgb(239, 51, 64).brightness(100) },
    // Salon izq
    {id: 17, state: new LightState().on().rgb(239, 51, 64).brightness(100) },
    // Escritorio
    {id: 18, state: new LightState().on().rgb(239, 51, 64).brightness(100) },
    // Tira leds
    {id: 20, state: new LightState().on().xy(0.4833,0.4735).brightness(100) },
    //{id: 20, state: new LightState().off() },
    // Lamparilla
    {id: 21, state: new LightState().on().rgb(253, 218, 36).brightness(100) }
];

const russiaflag = [
    // Esc izq
    {id: 13, state: new LightState().on().rgb(0, 51, 160).brightness(100) },
    // Esc der
    {id: 14, state: new LightState().on().rgb(0, 51, 160).brightness(100) },
    // Salon der
    {id: 16, state: new LightState().on().rgb(218, 41, 28).brightness(100) },
    // Salon izq
    {id: 17, state: new LightState().on().rgb(218, 41, 28).brightness(100) },
    // Escritorio
    {id: 18, state: new LightState().on().rgb(218, 41, 28).brightness(100) },
    // Tira leds
    {id: 20, state: new LightState().on().xy(0.1379,0.0864).brightness(100) },
    //{id: 20, state: new LightState().off() },
    // Lamparilla
    {id: 21, state: new LightState().on().rgb(0, 51, 160).brightness(100) }
];

const maltaflag = [
    // Esc izq
    {id: 13, state: new LightState().on().rgb(207, 20, 43).brightness(100) },
    // Esc der
    {id: 14, state: new LightState().on().rgb(207, 20, 43).brightness(100) },
    // Salon der
    {id: 16, state: new LightState().on().rgb(207, 20, 43).brightness(100) },
    // Salon izq
    {id: 17, state: new LightState().on().rgb(207, 20, 43).brightness(100) },
    // Escritorio
    {id: 18, state: new LightState().on().rgb(207, 20, 43).brightness(100) },
    // Tira leds
    {id: 20, state: new LightState().on().xy(0.6693,0.2918).brightness(100) },
    // Lamparilla
    {id: 21, state: new LightState().on().rgb(207, 20, 43).brightness(100) }
];

const portugalflag = [
    // Esc izq
    {id: 13, state: new LightState().on().rgb(4,106,56).brightness(100) },
    // Esc der
    {id: 14, state: new LightState().on().rgb(4,106,56).brightness(100) },
    // Salon der
    {id: 16, state: new LightState().on().rgb(218,41,28).brightness(100) },
    // Salon izq
    {id: 17, state: new LightState().on().rgb(218,41,28).brightness(100) },
    // Escritorio
    {id: 18, state: new LightState().on().rgb(218,41,28).brightness(100) },
    // Tira leds
    {id: 20, state: new LightState().on().xy(0.166,0.5555).brightness(100) },
    // Lamparilla
    {id: 21, state: new LightState().on().rgb(4,106,56).brightness(100) }
];

const serbiaflag = [
    // Esc izq
    {id: 13, state: new LightState().on().rgb(228,0,70).brightness(100) },
    // Esc der
    {id: 14, state: new LightState().on().rgb(228,0,70).brightness(100) },
    // Salon der
    {id: 16, state: new LightState().on().rgb(1,33,105).brightness(100) },
    // Salon izq
    {id: 17, state: new LightState().on().rgb(1,33,105).brightness(100) },
    // Escritorio
    {id: 18, state: new LightState().on().rgb(1,33,105).brightness(100) },
    // Tira leds
    {id: 20, state: new LightState().on().xy(0.6495,0.2758).brightness(100) },
    // Lamparilla
    {id: 21, state: new LightState().on().rgb(228,0,70).brightness(100) }
];

const ukflag = [
    // Esc izq
    {id: 13, state: new LightState().on().rgb(1,33,105).brightness(100) },
    // Esc der
    {id: 14, state: new LightState().on().rgb(1,33,105).brightness(100) },
    // Salon der
    {id: 16, state: new LightState().on().rgb(200,16,46).brightness(100) },
    // Salon izq
    {id: 17, state: new LightState().on().rgb(200,16,46).brightness(100) },
    // Escritorio
    {id: 18, state: new LightState().on().rgb(1,33,105).brightness(100) },
    // Tira leds
    {id: 20, state: new LightState().on().xy(0.1391,0.0929).brightness(100) },
    // Lamparilla
    {id: 21, state: new LightState().on().rgb(200,16,46).brightness(100) }
];

const greeceflag = [
    // Esc izq
    {id: 13, state: new LightState().on().rgb(0,20,137).brightness(100) },
    // Esc der
    {id: 14, state: new LightState().on().rgb(0,20,137).brightness(100) },
    // Salon der
    {id: 16, state: new LightState().on().rgb(0,20,137).brightness(100) },
    // Salon izq
    {id: 17, state: new LightState().on().rgb(0,20,137).brightness(100) },
    // Escritorio
    {id: 18, state: new LightState().on().rgb(0,20,137).brightness(100) },
    // Tira leds
    {id: 20, state: new LightState().on().xy(0.1363,0.0544).brightness(100) },
    // Lamparilla
    {id: 21, state: new LightState().on().rgb(0,20,137).brightness(100) }
];

const suizaflag = [
    // Esc izq
    {id: 13, state: new LightState().on().rgb(218,41,28).brightness(100) },
    // Esc der
    {id: 14, state: new LightState().on().rgb(218,41,28).brightness(100) },
    // Salon der
    {id: 16, state: new LightState().on().rgb(218,41,28).brightness(100) },
    // Salon izq
    {id: 17, state: new LightState().on().rgb(218,41,28).brightness(100) },
    // Escritorio
    {id: 18, state: new LightState().on().rgb(218,41,28).brightness(100) },
    // Tira leds
    {id: 20, state: new LightState().on().xy(0.6744,0.3069).brightness(100) },
    // Lamparilla
    {id: 21, state: new LightState().on().rgb(218,41,28).brightness(100) }
];

const icelandflag = [
    // Esc izq
    {id: 13, state: new LightState().on().rgb(0,48,135).brightness(100) },
    // Esc der
    {id: 14, state: new LightState().on().rgb(0,48,135).brightness(100) },
    // Salon der
    {id: 16, state: new LightState().on().rgb(0,48,135).brightness(100) },
    // Salon izq
    {id: 17, state: new LightState().on().rgb(210,38,48).brightness(100) },
    // Escritorio
    {id: 18, state: new LightState().on().rgb(0,48,135).brightness(100) },
    // Tira leds
    {id: 20, state: new LightState().on().xy(0.1386,0.099).brightness(100) },
    // Lamparilla
    {id: 21, state: new LightState().on().rgb(210,38,48).brightness(100) }
];
const spainflag = [
    // Esc izq
    {id: 13, state: new LightState().on().rgb(170, 21, 27).brightness(100) },
    // Esc der
    {id: 14, state: new LightState().on().rgb(170, 21, 27).brightness(100) },
    // Salon der
    {id: 16, state: new LightState().on().rgb(241, 191, 0).brightness(100) },
    // Salon izq
    {id: 17, state: new LightState().on().rgb(241, 191, 0).brightness(100) },
    // Escritorio
    {id: 18, state: new LightState().on().rgb(170, 21, 27).brightness(100) },
    // Tira leds
    {id: 20, state: new LightState().on().xy(0.6733,0.2983).brightness(100) },
    // Lamparilla
    {id: 21, state: new LightState().on().rgb(241, 191, 0).brightness(100) }
];

const moldovaflag = [
    // Esc izq
    {id: 13, state: new LightState().on().rgb(0, 70, 174).brightness(100) },
    // Esc der
    {id: 14, state: new LightState().on().rgb(0, 70, 174).brightness(100) },
    // Salon der
    {id: 16, state: new LightState().on().rgb(204, 9, 47).brightness(100) },
    // Salon izq
    {id: 17, state: new LightState().on().rgb(204, 9, 47).brightness(100) },
    // Escritorio
    {id: 18, state: new LightState().on().rgb(204, 9, 47).brightness(100) },
    // Tira leds
    {id: 20, state: new LightState().on().xy(0.1391,0.109).brightness(100) },
    // Lamparilla
    {id: 21, state: new LightState().on().rgb(204, 9, 47).brightness(100) }
];
const germanyflag = [
    // Esc izq
    {id: 13, state: new LightState().on().rgb(255, 206, 0).brightness(100) },
    // Esc der
    {id: 14, state: new LightState().on().rgb(255, 206, 0).brightness(100) },
    // Salon der
    {id: 16, state: new LightState().on().rgb(221, 0, 0).brightness(100) },
    // Salon izq
    {id: 17, state: new LightState().on().rgb(221, 0, 0).brightness(100) },
    // Escritorio
    {id: 18, state: new LightState().on().rgb(221, 0, 0).brightness(100) },
    // Tira leds
    {id: 20, state: new LightState().on().xy(0.7006,0.2993).brightness(100) },
    // Lamparilla
    {id: 21, state: new LightState().on().rgb(255, 206, 0).brightness(100) }
];
const finlandflag = [
    // Esc izq
    {id: 13, state: new LightState().on().rgb(0, 47, 108).brightness(100) },
    // Esc der
    {id: 14, state: new LightState().on().rgb(0, 47, 108).brightness(100) },
    // Salon der
    {id: 16, state: new LightState().on().rgb(0, 47, 108).brightness(100) },
    // Salon izq
    {id: 17, state: new LightState().on().rgb(0, 47, 108).brightness(100) },
    // Escritorio
    {id: 18, state: new LightState().on().rgb(0, 47, 108).brightness(100) },
    // Tira leds
    {id: 20, state: new LightState().on().xy(0.1401,0.1277).brightness(100) },
    // Lamparilla
    {id: 21, state: new LightState().on().rgb(0, 47, 108).brightness(100) }
];

const bulgariaflag = [
    // Esc izq
    {id: 13, state: new LightState().on().rgb(214, 38, 18).brightness(100) },
    // Esc der
    {id: 14, state: new LightState().on().rgb(214, 38, 18).brightness(100) },
    // Salon der
    {id: 16, state: new LightState().on().rgb(0, 150, 110).brightness(100) },
    // Salon izq
    {id: 17, state: new LightState().on().rgb(0, 150, 110).brightness(100) },
    // Escritorio
    {id: 18, state: new LightState().on().rgb(0, 150, 110).brightness(100) },
    // Tira leds
    {id: 20, state: new LightState().on().xy(0.1574,0.4599).brightness(100) },
    // Lamparilla
    {id: 21, state: new LightState().on().rgb(214, 38, 18).brightness(100) }
];

const lithuaniaflag = [
    // Esc izq
    {id: 13, state: new LightState().on().rgb(0, 106, 68).brightness(100) },
    // Esc der
    {id: 14, state: new LightState().on().rgb(0, 106, 68).brightness(100) },
    // Salon der
    {id: 16, state: new LightState().on().rgb(193, 39, 45).brightness(100) },
    // Salon izq
    {id: 17, state: new LightState().on().rgb(193, 39, 45).brightness(100) },
    // Escritorio
    {id: 18, state: new LightState().on().rgb(0, 106, 68).brightness(100) },
    // Tira leds
    {id: 20, state: new LightState().on().xy(0.5304,0.4393).brightness(100) },
    // Lamparilla
    {id: 21, state: new LightState().on().rgb(193, 39, 45).brightness(100) }
];

const ukraineflag = [
    // Esc izq
    {id: 13, state: new LightState().on().rgb(0, 91, 187).brightness(100) },
    // Esc der
    {id: 14, state: new LightState().on().rgb(255, 213, 0).brightness(100) },
    // Salon der
    {id: 16, state: new LightState().on().rgb(0, 91, 187).brightness(100) },
    // Salon izq
    {id: 17, state: new LightState().on().rgb(255, 213, 0).brightness(100) },
    // Escritorio
    {id: 18, state: new LightState().on().rgb(0, 91, 187).brightness(100) },
    // Tira leds
    {id: 20, state: new LightState().on().xy(0.1405,0.1361).brightness(100) },
    // Lamparilla
    {id: 21, state: new LightState().on().rgb(255, 213, 0).brightness(100) }
];

const franceflag = [
    // Esc izq
    {id: 13, state: new LightState().on().rgb(0, 85, 164).brightness(100) },
    // Esc der
    {id: 14, state: new LightState().on().rgb(0, 85, 164).brightness(100) },
    // Salon der
    {id: 16, state: new LightState().on().rgb(239, 65, 53).brightness(100) },
    // Salon izq
    {id: 17, state: new LightState().on().rgb(0, 85, 164).brightness(100) },
    // Escritorio
    {id: 18, state: new LightState().on().rgb(239, 65, 53).brightness(100) },
    // Tira leds
    {id: 20, state: new LightState().on().xy(0.6466,0.3104).brightness(100) },
    // Lamparilla
    {id: 21, state: new LightState().on().rgb(0, 85, 164).brightness(100) }
];

const azerbaijanflag = [
    // Esc izq
    {id: 13, state: new LightState().on().rgb(0, 185, 228).brightness(100) },
    // Esc der
    {id: 14, state: new LightState().on().rgb(0, 185, 228).brightness(100) },
    // Salon der
    {id: 16, state: new LightState().on().rgb(63, 156, 53).brightness(100) },
    // Salon izq
    {id: 17, state: new LightState().on().rgb(237, 41, 57).brightness(100) },
    // Escritorio
    {id: 18, state: new LightState().on().rgb(63, 156, 53).brightness(100) },
    // Tira leds
    {id: 20, state: new LightState().on().xy(0.1473,0.2653).brightness(100) },
    // Lamparilla
    {id: 21, state: new LightState().on().rgb(237, 41, 57).brightness(100) }
];

const norwayflag = [
    // Esc izq
    {id: 13, state: new LightState().on().rgb(0, 48, 135).brightness(100) },
    // Esc der
    {id: 14, state: new LightState().on().rgb(0, 48, 135).brightness(100) },
    // Salon der
    {id: 16, state: new LightState().on().rgb(200, 16, 46).brightness(100) },
    // Salon izq
    {id: 17, state: new LightState().on().rgb(0, 48, 135).brightness(100) },
    // Escritorio
    {id: 18, state: new LightState().on().rgb(200, 16, 46).brightness(100) },
    // Tira leds
    {id: 20, state: new LightState().on().xy(0.6649,0.2884).brightness(100) },
    // Lamparilla
    {id: 21, state: new LightState().on().rgb(200, 16, 46).brightness(100) }
];

const nlflag = [
    // Esc izq
    {id: 13, state: new LightState().on().rgb(174, 28, 40).brightness(100) },
    // Esc der
    {id: 14, state: new LightState().on().rgb(174, 28, 40).brightness(100) },
    // Salon der
    {id: 16, state: new LightState().on().rgb(33, 70, 139).brightness(100) },
    // Salon izq
    {id: 17, state: new LightState().on().rgb(174, 28, 40).brightness(100) },
    // Escritorio
    {id: 18, state: new LightState().on().rgb(174, 28, 40).brightness(100) },
    // Tira leds
    {id: 20, state: new LightState().on().xy(0.1624,0.1523).brightness(100) },
    // Lamparilla
    {id: 21, state: new LightState().on().rgb(33, 70, 139).brightness(100) }
];

const italyflag = [
    // Esc izq
    {id: 13, state: new LightState().on().rgb(205, 33, 42).brightness(100) },
    // Esc der
    {id: 14, state: new LightState().on().rgb(205, 33, 42).brightness(100) },
    // Salon der
    {id: 16, state: new LightState().on().rgb(0, 140, 69).brightness(100) },
    // Salon izq
    {id: 17, state: new LightState().on().rgb(205, 33, 42).brightness(100) },
    // Escritorio
    {id: 18, state: new LightState().on().rgb(0, 140, 69).brightness(100) },
    // Tira leds
    {id: 20, state: new LightState().on().xy(0.1638,0.5823).brightness(100) },
    // Lamparilla
    {id: 21, state: new LightState().on().rgb(0, 140, 69).brightness(100) }
];

const swedenflag = [
    // Esc izq
    {id: 13, state: new LightState().on().rgb(0, 75, 135).brightness(100) },
    // Esc der
    {id: 14, state: new LightState().on().rgb(0, 75, 135).brightness(100) },
    // Salon der
    {id: 16, state: new LightState().on().rgb(255, 205, 0).brightness(100) },
    // Salon izq
    {id: 17, state: new LightState().on().rgb(0, 75, 135).brightness(100) },
    // Escritorio
    {id: 18, state: new LightState().on().rgb(255, 205, 0).brightness(100) },
    // Tira leds
    {id: 20, state: new LightState().on().xy(0.5075,0.4629).brightness(100) },
    // Lamparilla
    {id: 21, state: new LightState().on().rgb(255, 205, 0).brightness(100) }
];

const sanmarinoflag = [
    // Esc izq
    {id: 13, state: new LightState().on().rgb(94, 182, 228).brightness(100) },
    // Esc der
    {id: 14, state: new LightState().on().rgb(94, 182, 228).brightness(100) },
    // Salon der
    {id: 16, state: new LightState().on().rgb(94, 182, 228).brightness(100) },
    // Salon izq
    {id: 17, state: new LightState().on().rgb(94, 182, 228).brightness(100) },
    // Escritorio
    {id: 18, state: new LightState().on().rgb(94, 182, 228).brightness(100) },
    // Tira leds
    {id: 20, state: new LightState().on().xy(0.1874,0.2626).brightness(100) },
    // Lamparilla
    {id: 21, state: new LightState().on().rgb(94, 182, 228).brightness(100) }
];
const COUNTRIES = {
    'CYPRUS' : cyprusflag,
    'ALBANIA' : albaniaflag,
    'ISRAEL' : israelflag,
    'BELGIUM' : belgiumflag,
    'RUSSIA' : russiaflag,
    'MALTA' : maltaflag,
    'PORTUGAL' : portugalflag,
    'SERBIA' : serbiaflag,
    'UNITED KINGDOM' : ukflag,
    'GREECE' : greeceflag,
    'SWITZERLAND' : suizaflag,
    'ICELAND' : icelandflag,
    'SPAIN' : spainflag,
    'MOLDOVA' : moldovaflag,
    'GERMANY' : germanyflag,
    'FINLAND' : finlandflag,
    'BULGARIA' : bulgariaflag,
    'LITHUANIA' : lithuaniaflag,
    'UKRAINE' : ukraineflag,
    'FRANCE' : franceflag,
    'AZERBAIJAN': azerbaijanflag,
    'NORWAY' : norwayflag,
    'THE NETHERLANDS' : nlflag,
    'ITALY' : italyflag,
    'SWEDEN' : swedenflag,
    'SAN MARINO' : sanmarinoflag
};