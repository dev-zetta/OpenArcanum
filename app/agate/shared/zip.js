// https://github.com/antelle/node-stream-zip

const StreamZip = require('node-stream-zip');
const zip = new StreamZip({
    file: 'archive.zip',
    storeEntries: true
});

// Handle errors
zip.on('error', err => { /*...*/ });

zip.on('ready', () => {
    console.log('Entries read: ' + zip.entriesCount);
    for (const entry of Object.values(zip.entries())) {
        const desc = entry.isDirectory ? 'directory' : `${entry.size} bytes`;
        console.log(`Entry ${entry.name}: ${desc}`);
    }
    // Do not forget to close the file once you're done
    zip.close()
});
