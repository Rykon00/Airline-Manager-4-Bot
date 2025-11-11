// Analysiere die planes.json Struktur
const fs = require('fs');
const path = require('path');

const planesPath = path.join(process.cwd(), 'data', 'planes.json');

if (fs.existsSync(planesPath)) {
    const data = JSON.parse(fs.readFileSync(planesPath, 'utf-8'));
    console.log(`Total planes: ${data.length}`);
    
    if (data.length > 0) {
        const sample = data[0];
        console.log('\nSample plane structure:');
        console.log(JSON.stringify(sample, null, 2));
        
        // Check for flight history
        if (sample.flightHistory) {
            console.log(`\nFlight history entries: ${sample.flightHistory.length}`);
            if (sample.flightHistory.length > 0) {
                console.log('\nSample flight:');
                console.log(JSON.stringify(sample.flightHistory[0], null, 2));
            }
        }
    }
} else {
    console.log('No planes.json found');
}
