
var internalModuleCache = {}
  , debug = require('./common').debug
  , Module = require('./module')
  , resolve = require('./resolve')
  , assert = require('assert')

  exports.defaultLoad = defaultLoad
  exports.mamake = mamake
  exports.makeMake = makeMake
  exports.makeRequire = makeRequire

  var natives = process.binding('natives'); //refactor this out to call require

  function loadNative (id) {
    
    var m = new Module(id);
    internalModuleCache[id] = m;
    m.require = makeRequire(m,{cache: require.cache})

    var e = m._compile(getNative(id), id+".js");
    if (e) throw e; // error compiling native module
    return m;
  }

  exports.requireNative = requireNative;//this doesn't appear to be used anywhere....

  function requireNative (id) {
    if (internalModuleCache.hasOwnProperty(id) && internalModuleCache[id]) return internalModuleCache[id].exports;
    if (!getNative(id)) throw new Error('No such native module ' + id);
    return loadNative(id).exports;
  }

/*
       ====================== load modules ===========================
*/

  exports.loadModule  = loadModule
  exports.loadResolvedModule  = loadResolvedModule
  
  function loadModule (request, parent, makeR, moduleCache) {
    var resolved = resolve.resolveModuleFilename(request, parent);
    var id = resolved[0];
    var filename = resolved[1];

    return loadResolvedModule (id, filename, parent, makeR, moduleCache)
  };

  function loadResolvedModule (id,filename,parent,makeR,moduleCache){

    assert.ok(moduleCache,"loadResolvedModule needs a moduleCache")

    var cachedNative = internalModuleCache.hasOwnProperty(id) && internalModuleCache[id];
    if (cachedNative) {
      return cachedNative;
    }
    if (getNative(id)) {
      debug('load native module ' + id);
      return loadNative(id);
    }

    var cachedModule = moduleCache[filename];

    if (cachedModule) return cachedModule;
    
    var module = new Module(id, parent);

    makeR = makeR || makeMake({cache:moduleCache})

    moduleCache[filename] = module;

    module.require = makeR.call(module,module);//intercepts creation of require so it can me remapped. called as module, to pass old test.
    module.load(filename);

    return module;
  }

/*
       ====================== load modules ===========================
*/

    function defaultLoad (id,filename,parent,makeR,moduleCache){
      return loadResolvedModule(id,filename,parent,makeR,moduleCache).exports
    }
    function mamake(resolver,load,make,cache){
      var tools = {
        resolve: resolver
      , load: load
      , make: make
      , cache: cache
      }

      return makeMake(tools)
    }
    
    function makeMake(tools){
      return function (module) {
      //console.log(tools)
      return makeRequire(module,tools)}
    }
    
      function getNative(request){
    return natives.hasOwnProperty(request) && natives[request]
  }

    
    function makeRequire(module,tools){
      tools = tools || {}
      tools.resolve = tools.resolve || resolve.resolveModuleFilename
      tools.load = tools.load || defaultLoad
      tools.make = tools.make || makeMake({cache: tools.cache})

      assert.ok(tools.cache,"makeRequire needed a tools.cache")
      assert.ok(tools.make,"makeRequire needed a tools.make")

      newRequire.resolve = function(request) { return tools.resolve(request,module)[1]}
      
      return finishRequire(newRequire)

      function newRequire(request){
        var resolved = tools.resolve(request,module)
          , id = resolved[0]
          , filename = resolved[1]
        return tools.load(id,filename,module,tools.make,tools.cache)
      }
      
      function finishRequire(newRequire){
        newRequire.paths = resolve.modulePaths;
        newRequire.main = process.mainModule;

        newRequire.extensions = require.extensions;

        newRequire.registerExtension = require.registerExtension;
        newRequire.cache = tools.cache;
        return newRequire;
      }
    }
