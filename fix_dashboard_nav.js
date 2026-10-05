const fs = require('fs');
let js = fs.readFileSync('js/modulos/dashboard.js', 'utf8');

const regexes = [
    {
        search: /if \(_dom\.estoqueContainer\) _dom\.estoqueContainer\.classList\.add\('hidden'\);\s*if \(_dom\.filterBar\) _dom\.filterBar\.classList\.remove\('hidden'\);/,
        replace: `if (_dom.estoqueContainer) _dom.estoqueContainer.classList.add('hidden');
        if (_dom.garantiaContainer) _dom.garantiaContainer.classList.add('hidden');
        if (_dom.rankingContainer) _dom.rankingContainer.classList.add('hidden');
        if (_dom.filterBar) _dom.filterBar.classList.remove('hidden');`
    },
    {
        search: /if \(_dom\.vendasContainer\) _dom\.vendasContainer\.classList\.add\('hidden'\);\s*if \(_dom\.rankingContainer\) _dom\.rankingContainer\.classList\.add\('hidden'\);\s*if \(_dom\.filterBar\) _dom\.filterBar\.classList\.add\('hidden'\);\s*_renderEstoqueDashboard\(\);/,
        replace: `if (_dom.vendasContainer) _dom.vendasContainer.classList.add('hidden');
        if (_dom.rankingContainer) _dom.rankingContainer.classList.add('hidden');
        if (_dom.garantiaContainer) _dom.garantiaContainer.classList.add('hidden');
        if (_dom.filterBar) _dom.filterBar.classList.add('hidden');
        _renderEstoqueDashboard();`
    },
    {
        search: /if \(_dom\.vendasContainer\) _dom\.vendasContainer\.classList\.add\('hidden'\);\s*if \(_dom\.estoqueContainer\) _dom\.estoqueContainer\.classList\.add\('hidden'\);\s*if \(_dom\.filterBar\) _dom\.filterBar\.classList\.add\('hidden'\);\s*_renderRankingDashboard\(\);/,
        replace: `if (_dom.vendasContainer) _dom.vendasContainer.classList.add('hidden');
        if (_dom.estoqueContainer) _dom.estoqueContainer.classList.add('hidden');
        if (_dom.garantiaContainer) _dom.garantiaContainer.classList.add('hidden');
        if (_dom.filterBar) _dom.filterBar.classList.add('hidden');
        _renderRankingDashboard();`
    },
    {
        search: /if \(_dom\.rankingContainer\) _dom\.rankingContainer\.classList\.add\('hidden'\);\s*if \(_dom\.filterBar\) _dom\.filterBar\.classList\.add\('hidden'\);/,
        replace: `if (_dom.rankingContainer) _dom.rankingContainer.classList.add('hidden');
        if (_dom.garantiaContainer) _dom.garantiaContainer.classList.add('hidden');
        if (_dom.filterBar) _dom.filterBar.classList.add('hidden');`
    }
];

regexes.forEach(({search, replace}) => {
    js = js.replace(search, replace);
});

// Extra fix in `stop: function() {` just in case
const stopRegex = /_dom\.vendasContainer\?\.classList\.add\('hidden'\);/;
js = js.replace(stopRegex, `_dom.vendasContainer?.classList.add('hidden');\n            _dom.garantiaContainer?.classList.add('hidden');`);

fs.writeFileSync('js/modulos/dashboard.js', js);
console.log('Fixed navigation visibility');
