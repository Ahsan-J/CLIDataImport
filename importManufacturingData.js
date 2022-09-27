const fs = require('fs');
const path = require('path');
const readline = require("readline");
const mongoose = require('mongoose');

mongoose.connect('mongodb://localhost:27017/nexus');

function importManufacturingData(type, file) {
    let config = [];

    // Load the configuration based on given type
    try {
        config = require(`./${type}.config.json`);
    } catch (e) {
        throw `Unsupported type ${type}`
    };

    const Device = mongoose.model(type, config.reduce((result, value) => {
        if (value.dbName && value.type) {
            result[value.dbName] = value.type;
        }
        return result;
    }, {}));

    const filePath = path.resolve(__dirname, file);

    if (fs.existsSync(filePath)) {
        const inputStream = fs.createReadStream(filePath);
        const lineReader = readline.createInterface({
            input: inputStream,
            terminal: false,
        });

        let headings = [];

        lineReader.on("line", function (line) {
            if (!headings.length) {
                headings = line.replaceAll(`"`, '').split(",");
                return // Nothing needs to be processed on heading line
            }
            
            const dataRow = line.replaceAll(`"`, '').split(",")
            const device = new Device();
            for (let i = 0; i < dataRow.length; i++) {
                const value = dataRow[i];
                const heading = headings[i];
                const fieldMeta = config.find(v => v.header == heading);

                if(fieldMeta.ignore) continue;

                if(!fieldMeta) throw `Unsupported field meta not found for ${heading}`;
                
                if(!new RegExp(fieldMeta.criteria).test(value)) continue; // Validating data error

                device[fieldMeta.dbName] = value;
            }
            
            device.save();
        })

        lineReader.on('close', () => {
            // closing the connection and exiting the program
            // mongoose.connection.close();
        })
    }
}

const type = process.argv[2]?.toLowerCase(); // Third cmd argument will be type
const file = process.argv[3]; // Fourth cmd argument will be file path

importManufacturingData(type, file);