const fs = require('fs');
let c = fs.readFileSync('index.html', 'utf8');

c = c.replace(
  /id="orders-table-content"\s*class="bg-white rounded-lg shadow-md overflow-y-auto overflow-x-auto max-h-\[60vh\] mt-4 flex-grow"/,
  'id="orders-table-content" class="bg-white rounded-lg shadow-md overflow-y-auto overflow-x-auto max-h-[60vh] min-h-[250px] mt-4 flex-grow pb-24"'
);

fs.writeFileSync('index.html', c);
console.log('Fixed index.html classes');
