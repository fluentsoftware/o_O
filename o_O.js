!function() {

 /*                                         	HTML binding for Lulz 
                        ,ad8888ba,            
                       d8"'    `"8b           Power of KnockoutJS, with the agility of Backbone
                      d8'        `8b     
 ,adPPYba,            88          88          Elegantly binds objects to HTML
a8"     "8a           88          88     
8b       d8           Y8,        ,8P          Proxies through jQuery (or whatever $ is)
"8a,   ,a8"            Y8a.    .a8P           
 `"YbbdP"'              `"Y8888Y"'            Automatic dependency resolution
                                         
           888888888888                       Plays well with others
							
															                (c) 2012 by Jonah Fox (weepy), MIT Licensed */

var VERSION = "0.2.3";
var slice = Array.prototype.slice;

var Events = {	
  /*
 	* Create an immutable callback list, allowing traversal during modification. The tail is an empty object that will always be used as the next node.
 	* */
 	on: function(events, callback, context) {
 	  var ev;
 	  events = events.split(/\s+/);
 	  var calls = this._callbacks || (this._callbacks = {});
 	  while (ev = events.shift()) {

 	    var list  = calls[ev] || (calls[ev] = {});
 	    var tail = list.tail || (list.tail = list.next = {});
 	    tail.callback = callback;
 	    tail.context = context;
 	    list.tail = tail.next = {};
 	  }
 	  return this;
 	},

  /* 
   * Remove one or many callbacks. If context is null, removes all callbacks with that function. 
   * If callback is null, removes all callbacks for the event. 
 	 * If ev is null, removes all bound callbacks for all events.
 	 * */
 	off: function(events, callback, context) {
 	  var ev, calls, node;
 	  if (!events) {
 	    delete this._callbacks;
 	  } else if (calls = this._callbacks) {
 	    events = events.split(/\s+/);
 	    while (ev = events.shift()) {
 	      node = calls[ev];
 	      delete calls[ev];
 	      if (!callback || !node) continue;

 	    	// Create a new list, omitting the indicated event/context pairs.

 	      while ((node = node.next) && node.next) {
 	        if (node.callback === callback &&
 	          (!context || node.context === context)) continue;
 	        this.on(ev, node.callback, node.context);
 	      }
 	    }
 	  }
 	  return this;
 	},
  /*
   * Trigger an event, firing all bound callbacks. Callbacks are passed the same arguments as emit is, apart from the event name. 
   * Listening for "*" passes the true event name as the first argument.
   * */
  emit: function(events) {
    var event, node, calls, tail, args, all, rest;
    if (!(calls = this._callbacks)) return this;
    all = calls['all'];
    (events = events.split(/\s+/)).push(null);

    // Save references to the current heads & tails.
    while (event = events.shift()) {
      if (all) events.push({next: all.next, tail: all.tail, event: event});
      if (!(node = calls[event])) continue;
      events.push({next: node.next, tail: node.tail});
    }

    //Traverse each list, stopping when the saved tail is reached.

    rest = slice.call(arguments, 1);
    while (node = events.pop()) {
     tail = node.tail;
      args = node.event ? [node.event].concat(rest) : rest;
      while ((node = node.next) !== tail) {
        node.callback.apply(node.context || this, args);
      }
    }
    return this;
  }
}


 /*
  * Public function to return an observable property
  * sync: whether to emit changes immediately, or in the next event loop
  */


var propertyMethods = {
  incr: function (val) { return this(this.value + (val || 1)) },
  scale: function (val) { return this(this.value * (val || 1)) },
  toggle: function (val) { return this(!this.value) },
  change: function(fn) {
    fn
      ? this.on('set', fn)          // setup observer
      : this.emit('set', this(), this.old_val)
    return this
  },
  mirror: function(other, both) {
    other.change(function(val) {
      if(val != this.value) this(val)
    })
    other.change()
    both && other.mirror(this)
    return this
  },
  toString: function() { 
    return '<' + (this.type ? this.type + ':' : '') + this.value + '>'
  },
  bind: function(el) {
    o_O.bind(this, el)
    return this
  },
  emitset: function() {
    if(this._emitting) return   // property is already emitting to avoid circular problems
    this._emitting = true
    this.emit('set', this.value, this.old_value)
    delete this._emitting
  },
  timeout: 0,
  constructor: o_O  // fake this - useful for checking
}

function o_O(arg, type) { 
  var simple = typeof arg != 'function'
  
  function prop(v) {
    if(arguments.length) {
      prop.old_value = prop.value
      prop.value = simple ? v : arg(v)
      prop.emitset()
    } else {
      if(dependencies.checking)
         dependencies.emit('get', prop)   // emit to dependency checker
      if(!simple)
        prop.value = arg()
    }
    return prop.value
  }
  
  if(simple)
    prop.value = arg
  else
    each(dependencies(prop), function(dep) {
      dep.change(function() {
        prop.emitset()
      })
    })

  extend(prop, Events, propertyMethods)
  if(type) prop.type = type
  return prop
}

/*
 *  Calculate dependencies
 */
function dependencies(func) {
  var deps = []
  function add(dep) {
    if(indexOf(deps, dep) < 0 && dep != func) 
      deps.push(dep)
  }
  dependencies.checking = true      // we're checking dependencies
  dependencies.on('get', add)       // setup listener
  dependencies.lastResult = func()  // run the function
  dependencies.off('get', add)      // remove listener
  dependencies.checking = false     // no longer checking dependencies
  return deps
}
extend(dependencies, Events)

o_O.dependencies = dependencies


// returns a function from some text
o_O.expression = function(text) {
  o_O.expression.last = text      // remember the last case useful for debugging syntax errors
  return new Function('o_O', 'with(this) { return (' + text + '); } ')
}


/*
 * calculates the dependencies
 * calls the callback with the result
 * if running fn returns a function - nothing more happens
 * otherwise the callback is called with the function result everytime a dependency changes
 */

o_O.bindFunction = function(fn, callback) {
  var deps = dependencies(fn)
  var result = dependencies.lastResult
  var isEvent = typeof result == 'function'
  callback(result)
  
  // if this is an event watch for changes and reapply
  if(!isEvent) {
    each(deps, function(dep) {
      dep.on('set', function(value) {
        callback(fn())
      })
    })
  }
}


// shim layer with setTimeout fallback
var requestAnimFrame = (function(){
  return  window.requestAnimationFrame       || 
          window.webkitRequestAnimationFrame || 
          window.mozRequestAnimationFrame    || 
          window.oRequestAnimationFrame      || 
          window.msRequestAnimationFrame     || 
          function( callback ){
            window.setTimeout(callback, 1000 / 60);
          };
})();


var queueBinding = (function() {
  var fns = [], timeout;
  function run() {
    while(fns.length)
      fns.shift()()
    fns = []
    timeout = null
  }
  
  return function(fn) {
    fns.push(fn)
    timeout = timeout || requestAnimFrame(run)
  }
})();

/*
 * el: dom element
 * binding: name of the binding rule
 * expr: text containing binding specification
 * context: the object that we're binding
 */

o_O.bindElementToRule = function(el, rule, expr, context) {
  rule == '"class"' && (rule = "class");
  
  var expression = o_O.expression(expr);
  
  var trigger = function() {
    return expression.call(context, o_O.helpers);
  }
  
  var emitting;
  var arg;
  function run(newarg) {
    arg = newarg;
    if(emitting) return;
    
    emitting = true;    
    
    function emit() {
      emitting = false;
      
      var $el = $(el),
          y = typeof arg == 'function' && arg.constructor != o_O
                ? function() { return arg.apply(context, arguments) }
                : arg;
      if(y instanceof String) y = y.toString(); // strange problem
      
      if($.prototype[rule])
        return $el[rule](y); // return is so we can return false to stop propagation
      
      var fn = o_O.bindings[rule];
      fn
        ? fn.call(context, y, $el)
        : $el.attr(rule, y);
    }
    
    typeof arg == 'function' 
      ? emit() 
      : queueBinding(emit);
  }
  
  o_O.bindFunction(trigger, run)
}


/*
 * Helper function to extract rules from a css like string
 */
function extractRules(str) {
  if(!str) return []
  var rules = trim(str).split(";"), ret = [], i, bits, binding, param, rule
  
  for(var i=0; i <rules.length; i++) {
    rule = trim(rules[i])
    if(!rule) continue // for trailing ;
    bits = map(trim(rule).split(":"), trim)
    binding = trim(bits.shift())
    param = trim(bits.join(":"))
    ret.push([binding, param])
  }
  return ret
}

/*
 * Public function to bind an object to an element or selector
 * context: the object to bind
 * dom: the element or selector
 * recursing: internal flag to indicate wether it is an internal call
 */
o_O.bind = function(context, dom, recursing) {
  var $el = $(dom)
  if(!recursing) context.el = $el[0]
  
  var recurse = true
  var rules = extractRules($el.attr(o_O.bindingAttribute))
  
  for(var i=0; i <rules.length; i++) {
    var method = rules[i][0]
    var param = rules[i][1]
    if(method == 'with' || method == 'foreach') recurse = false
    o_O.bindElementToRule($el, method, param, context)
  }
  $el.attr(o_O.bindingAttribute,null)
  
  if(recurse) {
    $el.children().each(function(i, el) {
      o_O.bind(context, el, true)
    })
  }
}

/*
 * Retrieves HTML string from a dom node (that may have been changed due to binding)
 */
function getTemplate($el) {
  var template = $el.data('o_O:template')
  if(template == null) {
    template = $el.html()
    $el.html('')
    $el.attr(o_O.bindingAttribute, null) // should be here?
    $el.data('o_O:template', template)
  }
  return template
}

o_O.helpers = {
  // converts a DOM event from an element with a value into its value
  // useful for setting properties based on form events
  value: function(fn) {
    return function(e) { 
      return fn.call(this, $(e.currentTarget).val(), e) 
    }
  },
  // converts a mouse event callback to a callback with the mouse position relative to the target
  position: function(fn) {
  	return function(e) {
  	  var el = e.currentTarget
  		var o = $(el).offset()
      fn.call(this, e.pageX - o.left, e.pageY - o.top, e)
  	}
  }
}

/*                                     
 _    __|_ _ ._ _  |_ o._  _|o._  _  _ 
(_|_|_> |_(_)| | | |_)|| |(_||| |(_|_> 
                                  _|    */

/** 
 *  Override proxy methods to $
 *  this will be the context itself
 */

o_O.bindings = {
  /* Two-way binding to a form element
   * usage: bind='value: myProperty'
   * special cases for checkbox
   */
  value: function(property, $el) {
    $el.change(function(e) {
      var checkbox = $(this).attr('type') == 'checkbox'
      var val = checkbox ? (!!$(this).attr('checked')) : $(this).val()
      property(val, e)
    })

    if(property.on) {
      property.on('set', function(val) {
        $el.attr('type') == 'checkbox'
          ? $el.attr('checked', val) 
          : $el.val(val)
      })
      property.change() // force a change    
    }
  },
  /*
   * set visibility depenent on val
   */
  visible: function(val, $el) {
    val ? $el.show() : $el.hide()
  },
  'if': function(context, $el) {
    var template = getTemplate($el)
    $el.html(context ? template : '')
  },
  unless: function(val, $el) {
    return o_O.bindings['if'](!val, $el)
  },
  'with': function(context, $el) {
    var template = getTemplate($el)
    $el.html(context ? template : '')
    if(context) o_O.bind(context, $el)    
  },
  options: function(options, $el) {
    var isArray = options instanceof Array
    $.each(options, function(key, value) { 
      var text = isArray ? value : key
      $el.append($("<option>").attr("value", value).html(text))
    }) 
  },
  /* 
   * Allows binding of a list of items
   * list is expected to respond to forEach 
   */
  foreach: function(list, $el) {
    var template = getTemplate($el)
    
    // default renderer if list doesn't specify one
    function defaultRenderer(item) {
      $(template).each(function(i, elem) {
        var $$ = $(elem)
        $$.appendTo($el)
        o_O.bind(item, $$)
      })
    }
    
    var renderItem = list.renderItem || defaultRenderer

    $el.html('')
    list.forEach(function(item, index) {
      renderItem.call(list, item, $el, index)
    })
    list.onbind && list.onbind($el)
  },
  log: function(context, $el) {
    console.log('o_O', context, $el, this)
  },
  // general purpose
  // `call: fn` will run once - useful for `onbind` intialization
  // `call: fn()` will run once and also for fn's dependencies 
  call: function(func, $el) {
    typeof func == 'function' && func($el)
  }
}

/*         ___   __  __           _      _ 
   ___    / _ \ |  \/  | ___   __| | ___| |
  / _ \  | | | || |\/| |/ _ \ / _` |/ _ \ |
 | (_) | | |_| || |  | | (_) | (_| |  __/ |
  \___/___\___(_)_|  |_|\___/ \__,_|\___|_|
     |_____|                               
  																							
  Model with observable properties, subclasses, evented
*/

function model(o, proto) {  
  if(!(this instanceof model)) return new model(o, proto)
    
  o = o || {}
  this.properties = []
  for(var name in o) {
    model.addProperty(this, name, o[name])
    model.observeProperty(this, name)
  }
  
  var defaults = this.constructor.defaults
  
  for(var name in defaults) {
     if(name in o) continue
     var val = defaults[name]
     model.addProperty(this, name, val)
     model.observeProperty(this, name)
   }
  
  proto && extend(this, proto)
  this.initialize.apply(this, arguments)
}

extend(model, {
  observeProperty: function(model, name) {
    model[name].on('set', function(val, old) {
      model.emit('set:' + name, model, val, old)
    })
  
    model[name].on('set', function(val, old) {
      if(val === old) return
      var x = {}, y = {}    
      x[name] = val
      y[name] = old
      model.emit('update', model, x, y)
    })
  },
  addProperty: function(model, name, val) {
    model[name] = o_O(val)
    model.properties.push(name)
  },
  defaults: {},
  types: {},
  extend: function(defaults, protoProps, classProps) {
    defaults = defaults || {}
    var child = inherits(this, protoProps, classProps);
    child.defaults = defaults
    child.extend = this.extend;
    if(defaults.type) model.types[defaults.type] = child
    return child;
  },
  create: function(o) {
    var type = model.types[o.type]
    if(!type) throw new Error('no such Model with type: ' + o.type)
    return new type(o)
  }
})

extend(model.prototype, Events, {
  toString: function() {
    return '#<'+(this.type ? this.type() : 'model')+'>'
  },
  bind: function(el) {
    o_O.bind(this, el);
    return this;
  },
  initialize: function(o) {},
  valid: function() {
    return true
  },
  // update a json model of named values
  // if resultant model is invalid - it is set back to previous values
  // THIS SHOULD BE SIMPLIFIED
  update: function(o) {
    var old = {}, props = this.constructor.defaults
    for(var key in o) {
      if(key in props) {
        old[key] = this[key].value
        this[key].value = o[key]
      }
    }  
    if(this.valid()) {
      for(var key in old) {
        this[key].value = old[key]
        this[key](o[key])
      }
      this.emit('update', this, o, old)
      return old
    } 
    else {
      for(var key in old) this[key](old[key])
      return false
    }  
  },
  destroy: function() {
    this.emit('destroy', this)
  },
  toJSON: function() {
    var json = {}
    for(var i=0; i< this.properties.length;i++) {
      var prop = this.properties[i]
      json[prop] = this[prop]()
    }
    return json
  },
  clone: function() {
    return model.create(this.toJSON())
  }
})

o_O.model = model



/*        ___
  ___    / _ \  __ _ _ __ _ __ __ _ _   _
 / _ \  | | | |/ _` | '__| '__/ _` | | | |
| (_) | | |_| | (_| | |  | | | (_| | |_| |
 \___/___\___(_)__,_|_|  |_|  \__,_|\__, |
    |_____|                         |___/   */

function array(items) {
  if(!(this instanceof array)) return new array(items)
  
  var self = this
  this.items = []
  this.count = o_O(0)
  this.length = 0
  this.count.change(function(count) {
    self.length = count 
  })
  if(items) {
    for(var i=0; i< items.length; i++)
      this.push(items[i])
  }
}

extend(array, {
  add: function (arr, o, index) {
    arr.count.incr()
    
    if(o.on && o.emit) {
      o.on('all', arr._onevent, arr)
      o.emit('add', o, arr, index)
    }else{
      arr.emit('add', o, arr, index)
    }
    
    return arr.items.length
  },
  remove: function(arr, o, index) {
    arr.count.incr(-1) //force re-binding
    
    if(o.off && o.emit) {
      o.emit('remove', o, arr, index)
      o.off('all', arr._onevent, arr)
    } else {
      arr.emit('remove', o, index)
    }
    
    return o
  },
  extend: function() {
    return inherits.apply(this, arguments)
  }
})

extend(array.prototype, Events, {
  _onevent : function(ev, o, array) {
    if ((ev == 'add' || ev == 'remove') && array != this) return
    if (ev == 'destroy') {
      this.remove(o)
    }
    this.emit.apply(this, arguments)
  },
  bind: function(el) {
    o_O.bind(this, el)
    return this
  },
  indexOf: function(o){
    return this.items.indexOf(o)
  },
  filter: function(fn){
    return this.items.filter(fn)
  },
  find: function(fn){
    for(var i in this.items) {
      var it = this.items[i]
      if(fn(it, i)) return it
    }
  },
  map: function(fn) {
    this.count(); // force the dependency
    var ret = []
    for(var i = 0; i < this.length; i++) {
      var result = fn.call(this, this.items[i], i)
      ret.push(result)
    }
    return ret
  },
  push: function(o) {
    return this.insert(o, this.length)
  },
  unshift: function(o) {
    return this.insert(o, 0)
  },
  pop: function(){
    return this.removeAt(this.length-1) //remove(this, this.items.pop())
  },
  shift: function(){
    return this.removeAt(0) //remove(this, this.items.shift())
  },
  at: function(index) {
    return this.items[index]
  },
  insert: function(o, index) {
    if(index < 0 || index > this.count()) return false
    this.items.splice(index, 0, o)
    array.add(this, o, index)
    return o
  },
  removeAt: function(index) {
    if(index < 0 || index > this.count()) return false
    var o = this.items[index]
    this.items.splice(index, 1)
    array.remove(this, o, index)
    return o
  },
  remove: function(o) {
    var func = 'function' === typeof o,   // what about if o is a function itself? - perhaps this should be another method ?
        items = func ? this.items.filter(o) : [o],
        index,
        len = items.length
    for(var i = 0; i < len; i++){
      index = this.indexOf(items[i])
      if(index !== -1) this.removeAt(index)
    }
    return func ? items : items[0]
  },
  renderItem: function(item, $el, index) {
    var $$ = $(getTemplate($el))
    var nextElem = this.at(index).el || $el.children()[index]
    nextElem
      ? $$.insertBefore(nextElem)
      : $el.append($$)
    o_O.bind(item, $$)
  },
  onbind: function($el) {
    var self = this
    this.on('add', function(item, arr, index) {
      self.renderItem(item, $el, index)
    })
    this.on('remove', this.removeElement, this)
    this.el = $el[0]
  },
  removeElement: function(item, index) {
    $(item.el || $(this.el).children()[index]).remove()
  },
  toString: function() {
    return '#<o_O.array:' + this.length + '>'
  },
  toJSON: function() {
    return this.map(function(o) {
      return o.toJSON ? o.toJSON() : o
    })
  }
})

array.prototype.each = array.prototype.forEach = array.prototype.map

o_O.array = array

/* * * * * * * * * * 
 * HELPER FUNCTIONS
 */

function map(array, fn) {
  var ret = []
  for(var i=0; i<array.length;i++) ret[i] = fn(array[i], i)
  return ret
}

function extend(obj) {
  var args = slice.call(arguments, 1)
  for(var i=0; i<args.length;i++) {
    var source = args[i]
    for (var prop in source)
      obj[prop] = source[prop]
  }    
  return obj
}

function each(array, action) {
  if(array.forEach) return array.forEach(action)  
  for (var i= 0, n= array.length; i<n; i++)
    if (i in array)
      action.call(null, array[i], i, array);
}

function trim(s) {
  return s.replace(/^\s+|\s+$/g, '')
}

function indexOf(array, obj, start) {
  if(array.indexOf) return array.indexOf(obj, start)  
  for (var i = (start || 0), j = array.length; i < j; i++) {
     if (array[i] === obj) { return i; }
  }
  return -1;
}

function ctor(){};

function inherits(parent, protoProps, staticProps) {
  
  var child = function(a, b) {
    if(this instanceof child)
      parent.apply(this, arguments)
    else
      return new child(a, b)
  };
    
  if(protoProps && protoProps.hasOwnProperty('constructor'))
    child = protoProps.constructor

  extend(child, parent)
  ctor.prototype = parent.prototype
  child.prototype = new ctor()
  if (protoProps) extend(child.prototype, protoProps);
  if (staticProps) extend(child, staticProps);
  child.prototype.constructor = child;
  child.__super__ = parent.prototype;
  return child;
};

o_O.uuid = function(len) {
  return Math.random().toString(36).slice(2)
};

// export
o_O.bindingAttribute = 'data-bind';
o_O.inherits = inherits
o_O.extend = extend
o_O.Events = Events
o_O.VERSION = VERSION

if(typeof module == 'undefined') {
  var scripts = document.getElementsByTagName('script')
  var namespace = scripts[scripts.length-1].src.split('?')[1]
  window[namespace || 'o_O'] = o_O
}
else {
  module.exports = o_O
}

}();