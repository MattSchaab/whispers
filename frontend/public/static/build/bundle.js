var app = (function () {
  "use strict";

  function noop() {}
  function assign(tar, src) {
    // @ts-ignore
    for (const k in src) tar[k] = src[k];
    return tar;
  }
  function is_promise(value) {
    return (
      value && typeof value === "object" && typeof value.then === "function"
    );
  }
  function add_location(element, file, line, column, char) {
    element.__svelte_meta = {
      loc: { file, line, column, char },
    };
  }
  function run(fn) {
    return fn();
  }
  function blank_object() {
    return Object.create(null);
  }
  function run_all(fns) {
    fns.forEach(run);
  }
  function is_function(thing) {
    return typeof thing === "function";
  }
  function safe_not_equal(a, b) {
    return a != a
      ? b == b
      : a !== b || (a && typeof a === "object") || typeof a === "function";
  }
  function is_empty(obj) {
    return Object.keys(obj).length === 0;
  }
  function validate_store(store, name) {
    if (store != null && typeof store.subscribe !== "function") {
      throw new Error(`'${name}' is not a store with a 'subscribe' method`);
    }
  }
  function subscribe(store, ...callbacks) {
    if (store == null) {
      return noop;
    }
    const unsub = store.subscribe(...callbacks);
    return unsub.unsubscribe ? () => unsub.unsubscribe() : unsub;
  }
  function get_store_value(store) {
    let value;
    subscribe(store, (_) => (value = _))();
    return value;
  }
  function component_subscribe(component, store, callback) {
    component.$$.on_destroy.push(subscribe(store, callback));
  }
  function create_slot(definition, ctx, $$scope, fn) {
    if (definition) {
      const slot_ctx = get_slot_context(definition, ctx, $$scope, fn);
      return definition[0](slot_ctx);
    }
  }
  function get_slot_context(definition, ctx, $$scope, fn) {
    return definition[1] && fn
      ? assign($$scope.ctx.slice(), definition[1](fn(ctx)))
      : $$scope.ctx;
  }
  function get_slot_changes(definition, $$scope, dirty, fn) {
    if (definition[2] && fn) {
      const lets = definition[2](fn(dirty));
      if ($$scope.dirty === undefined) {
        return lets;
      }
      if (typeof lets === "object") {
        const merged = [];
        const len = Math.max($$scope.dirty.length, lets.length);
        for (let i = 0; i < len; i += 1) {
          merged[i] = $$scope.dirty[i] | lets[i];
        }
        return merged;
      }
      return $$scope.dirty | lets;
    }
    return $$scope.dirty;
  }
  function update_slot_base(
    slot,
    slot_definition,
    ctx,
    $$scope,
    slot_changes,
    get_slot_context_fn
  ) {
    if (slot_changes) {
      const slot_context = get_slot_context(
        slot_definition,
        ctx,
        $$scope,
        get_slot_context_fn
      );
      slot.p(slot_context, slot_changes);
    }
  }
  function get_all_dirty_from_scope($$scope) {
    if ($$scope.ctx.length > 32) {
      const dirty = [];
      const length = $$scope.ctx.length / 32;
      for (let i = 0; i < length; i++) {
        dirty[i] = -1;
      }
      return dirty;
    }
    return -1;
  }
  function exclude_internal_props(props) {
    const result = {};
    for (const k in props) if (k[0] !== "$") result[k] = props[k];
    return result;
  }
  function compute_rest_props(props, keys) {
    const rest = {};
    keys = new Set(keys);
    for (const k in props) if (!keys.has(k) && k[0] !== "$") rest[k] = props[k];
    return rest;
  }
  function null_to_empty(value) {
    return value == null ? "" : value;
  }
  function append(target, node) {
    target.appendChild(node);
  }
  function insert(target, node, anchor) {
    target.insertBefore(node, anchor || null);
  }
  function detach(node) {
    node.parentNode.removeChild(node);
  }
  function element(name) {
    return document.createElement(name);
  }
  function text(data) {
    return document.createTextNode(data);
  }
  function space() {
    return text(" ");
  }
  function empty() {
    return text("");
  }
  function listen(node, event, handler, options) {
    node.addEventListener(event, handler, options);
    return () => node.removeEventListener(event, handler, options);
  }
  function prevent_default(fn) {
    return function (event) {
      event.preventDefault();
      // @ts-ignore
      return fn.call(this, event);
    };
  }
  function attr(node, attribute, value) {
    if (value == null) node.removeAttribute(attribute);
    else if (node.getAttribute(attribute) !== value)
      node.setAttribute(attribute, value);
  }
  function set_attributes(node, attributes) {
    // @ts-ignore
    const descriptors = Object.getOwnPropertyDescriptors(node.__proto__);
    for (const key in attributes) {
      if (attributes[key] == null) {
        node.removeAttribute(key);
      } else if (key === "style") {
        node.style.cssText = attributes[key];
      } else if (key === "__value") {
        node.value = node[key] = attributes[key];
      } else if (descriptors[key] && descriptors[key].set) {
        node[key] = attributes[key];
      } else {
        attr(node, key, attributes[key]);
      }
    }
  }
  function children(element) {
    return Array.from(element.childNodes);
  }
  function set_style(node, key, value, important) {
    node.style.setProperty(key, value, important ? "important" : "");
  }
  function toggle_class(element, name, toggle) {
    element.classList[toggle ? "add" : "remove"](name);
  }
  function custom_event(type, detail, bubbles = false) {
    const e = document.createEvent("CustomEvent");
    e.initCustomEvent(type, bubbles, false, detail);
    return e;
  }

  let current_component;
  function set_current_component(component) {
    current_component = component;
  }
  function get_current_component() {
    if (!current_component)
      throw new Error("Function called outside component initialization");
    return current_component;
  }
  function onMount(fn) {
    get_current_component().$$.on_mount.push(fn);
  }
  function onDestroy(fn) {
    get_current_component().$$.on_destroy.push(fn);
  }
  function createEventDispatcher() {
    const component = get_current_component();
    return (type, detail) => {
      const callbacks = component.$$.callbacks[type];
      if (callbacks) {
        // TODO are there situations where events could be dispatched
        // in a server (non-DOM) environment?
        const event = custom_event(type, detail);
        callbacks.slice().forEach((fn) => {
          fn.call(component, event);
        });
      }
    };
  }
  function setContext(key, context) {
    get_current_component().$$.context.set(key, context);
  }
  function getContext(key) {
    return get_current_component().$$.context.get(key);
  }

  const dirty_components = [];
  const binding_callbacks = [];
  const render_callbacks = [];
  const flush_callbacks = [];
  const resolved_promise = Promise.resolve();
  let update_scheduled = false;
  function schedule_update() {
    if (!update_scheduled) {
      update_scheduled = true;
      resolved_promise.then(flush);
    }
  }
  function tick() {
    schedule_update();
    return resolved_promise;
  }
  function add_render_callback(fn) {
    render_callbacks.push(fn);
  }
  function add_flush_callback(fn) {
    flush_callbacks.push(fn);
  }
  let flushing = false;
  const seen_callbacks = new Set();
  function flush() {
    if (flushing) return;
    flushing = true;
    do {
      // first, call beforeUpdate functions
      // and update components
      for (let i = 0; i < dirty_components.length; i += 1) {
        const component = dirty_components[i];
        set_current_component(component);
        update(component.$$);
      }
      set_current_component(null);
      dirty_components.length = 0;
      while (binding_callbacks.length) binding_callbacks.pop()();
      // then, once components are updated, call
      // afterUpdate functions. This may cause
      // subsequent updates...
      for (let i = 0; i < render_callbacks.length; i += 1) {
        const callback = render_callbacks[i];
        if (!seen_callbacks.has(callback)) {
          // ...so guard against infinite loops
          seen_callbacks.add(callback);
          callback();
        }
      }
      render_callbacks.length = 0;
    } while (dirty_components.length);
    while (flush_callbacks.length) {
      flush_callbacks.pop()();
    }
    update_scheduled = false;
    flushing = false;
    seen_callbacks.clear();
  }
  function update($$) {
    if ($$.fragment !== null) {
      $$.update();
      run_all($$.before_update);
      const dirty = $$.dirty;
      $$.dirty = [-1];
      $$.fragment && $$.fragment.p($$.ctx, dirty);
      $$.after_update.forEach(add_render_callback);
    }
  }
  const outroing = new Set();
  let outros;
  function group_outros() {
    outros = {
      r: 0,
      c: [],
      p: outros, // parent group
    };
  }
  function check_outros() {
    if (!outros.r) {
      run_all(outros.c);
    }
    outros = outros.p;
  }
  function transition_in(block, local) {
    if (block && block.i) {
      outroing.delete(block);
      block.i(local);
    }
  }
  function transition_out(block, local, detach, callback) {
    if (block && block.o) {
      if (outroing.has(block)) return;
      outroing.add(block);
      outros.c.push(() => {
        outroing.delete(block);
        if (callback) {
          if (detach) block.d(1);
          callback();
        }
      });
      block.o(local);
    }
  }

  function handle_promise(promise, info) {
    const token = (info.token = {});
    function update(type, index, key, value) {
      if (info.token !== token) return;
      info.resolved = value;
      let child_ctx = info.ctx;
      if (key !== undefined) {
        child_ctx = child_ctx.slice();
        child_ctx[key] = value;
      }
      const block = type && (info.current = type)(child_ctx);
      let needs_flush = false;
      if (info.block) {
        if (info.blocks) {
          info.blocks.forEach((block, i) => {
            if (i !== index && block) {
              group_outros();
              transition_out(block, 1, 1, () => {
                if (info.blocks[i] === block) {
                  info.blocks[i] = null;
                }
              });
              check_outros();
            }
          });
        } else {
          info.block.d(1);
        }
        block.c();
        transition_in(block, 1);
        block.m(info.mount(), info.anchor);
        needs_flush = true;
      }
      info.block = block;
      if (info.blocks) info.blocks[index] = block;
      if (needs_flush) {
        flush();
      }
    }
    if (is_promise(promise)) {
      const current_component = get_current_component();
      promise.then(
        (value) => {
          set_current_component(current_component);
          update(info.then, 1, info.value, value);
          set_current_component(null);
        },
        (error) => {
          set_current_component(current_component);
          update(info.catch, 2, info.error, error);
          set_current_component(null);
          if (!info.hasCatch) {
            throw error;
          }
        }
      );
      // if we previously had a then/catch block, destroy it
      if (info.current !== info.pending) {
        update(info.pending, 0);
        return true;
      }
    } else {
      if (info.current !== info.then) {
        update(info.then, 1, info.value, promise);
        return true;
      }
      info.resolved = promise;
    }
  }
  function update_await_block_branch(info, ctx, dirty) {
    const child_ctx = ctx.slice();
    const { resolved } = info;
    if (info.current === info.then) {
      child_ctx[info.value] = resolved;
    }
    if (info.current === info.catch) {
      child_ctx[info.error] = resolved;
    }
    info.block.p(child_ctx, dirty);
  }

  function get_spread_update(levels, updates) {
    const update = {};
    const to_null_out = {};
    const accounted_for = { $$scope: 1 };
    let i = levels.length;
    while (i--) {
      const o = levels[i];
      const n = updates[i];
      if (n) {
        for (const key in o) {
          if (!(key in n)) to_null_out[key] = 1;
        }
        for (const key in n) {
          if (!accounted_for[key]) {
            update[key] = n[key];
            accounted_for[key] = 1;
          }
        }
        levels[i] = n;
      } else {
        for (const key in o) {
          accounted_for[key] = 1;
        }
      }
    }
    for (const key in to_null_out) {
      if (!(key in update)) update[key] = undefined;
    }
    return update;
  }
  function get_spread_object(spread_props) {
    return typeof spread_props === "object" && spread_props !== null
      ? spread_props
      : {};
  }

  function bind(component, name, callback) {
    const index = component.$$.props[name];
    if (index !== undefined) {
      component.$$.bound[index] = callback;
      callback(component.$$.ctx[index]);
    }
  }
  function create_component(block) {
    block && block.c();
  }
  function mount_component(component, target, anchor, customElement) {
    const { fragment, on_mount, on_destroy, after_update } = component.$$;
    fragment && fragment.m(target, anchor);
    if (!customElement) {
      // onMount happens before the initial afterUpdate
      add_render_callback(() => {
        const new_on_destroy = on_mount.map(run).filter(is_function);
        if (on_destroy) {
          on_destroy.push(...new_on_destroy);
        } else {
          // Edge case - component was destroyed immediately,
          // most likely as a result of a binding initialising
          run_all(new_on_destroy);
        }
        component.$$.on_mount = [];
      });
    }
    after_update.forEach(add_render_callback);
  }
  function destroy_component(component, detaching) {
    const $$ = component.$$;
    if ($$.fragment !== null) {
      run_all($$.on_destroy);
      $$.fragment && $$.fragment.d(detaching);
      // TODO null out other refs, including component.$$ (but need to
      // preserve final state?)
      $$.on_destroy = $$.fragment = null;
      $$.ctx = [];
    }
  }
  function make_dirty(component, i) {
    if (component.$$.dirty[0] === -1) {
      dirty_components.push(component);
      schedule_update();
      component.$$.dirty.fill(0);
    }
    component.$$.dirty[(i / 31) | 0] |= 1 << i % 31;
  }
  function init(
    component,
    options,
    instance,
    create_fragment,
    not_equal,
    props,
    append_styles,
    dirty = [-1]
  ) {
    const parent_component = current_component;
    set_current_component(component);
    const $$ = (component.$$ = {
      fragment: null,
      ctx: null,
      // state
      props,
      update: noop,
      not_equal,
      bound: blank_object(),
      // lifecycle
      on_mount: [],
      on_destroy: [],
      on_disconnect: [],
      before_update: [],
      after_update: [],
      context: new Map(
        parent_component ? parent_component.$$.context : options.context || []
      ),
      // everything else
      callbacks: blank_object(),
      dirty,
      skip_bound: false,
      root: options.target || parent_component.$$.root,
    });
    append_styles && append_styles($$.root);
    let ready = false;
    $$.ctx = instance
      ? instance(component, options.props || {}, (i, ret, ...rest) => {
          const value = rest.length ? rest[0] : ret;
          if ($$.ctx && not_equal($$.ctx[i], ($$.ctx[i] = value))) {
            if (!$$.skip_bound && $$.bound[i]) $$.bound[i](value);
            if (ready) make_dirty(component, i);
          }
          return ret;
        })
      : [];
    $$.update();
    ready = true;
    run_all($$.before_update);
    // `false` as a special case of no DOM component
    $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
    if (options.target) {
      if (options.hydrate) {
        const nodes = children(options.target);
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        $$.fragment && $$.fragment.l(nodes);
        nodes.forEach(detach);
      } else {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        $$.fragment && $$.fragment.c();
      }
      if (options.intro) transition_in(component.$$.fragment);
      mount_component(
        component,
        options.target,
        options.anchor,
        options.customElement
      );
      flush();
    }
    set_current_component(parent_component);
  }
  /**
   * Base class for Svelte components. Used when dev=false.
   */
  class SvelteComponent {
    $destroy() {
      destroy_component(this, 1);
      this.$destroy = noop;
    }
    $on(type, callback) {
      const callbacks =
        this.$$.callbacks[type] || (this.$$.callbacks[type] = []);
      callbacks.push(callback);
      return () => {
        const index = callbacks.indexOf(callback);
        if (index !== -1) callbacks.splice(index, 1);
      };
    }
    $set($$props) {
      if (this.$$set && !is_empty($$props)) {
        this.$$.skip_bound = true;
        this.$$set($$props);
        this.$$.skip_bound = false;
      }
    }
  }

  function dispatch_dev(type, detail) {
    document.dispatchEvent(
      custom_event(type, Object.assign({ version: "3.42.1" }, detail), true)
    );
  }
  function append_dev(target, node) {
    dispatch_dev("SvelteDOMInsert", { target, node });
    append(target, node);
  }
  function insert_dev(target, node, anchor) {
    dispatch_dev("SvelteDOMInsert", { target, node, anchor });
    insert(target, node, anchor);
  }
  function detach_dev(node) {
    dispatch_dev("SvelteDOMRemove", { node });
    detach(node);
  }
  function listen_dev(
    node,
    event,
    handler,
    options,
    has_prevent_default,
    has_stop_propagation
  ) {
    const modifiers =
      options === true
        ? ["capture"]
        : options
        ? Array.from(Object.keys(options))
        : [];
    if (has_prevent_default) modifiers.push("preventDefault");
    if (has_stop_propagation) modifiers.push("stopPropagation");
    dispatch_dev("SvelteDOMAddEventListener", {
      node,
      event,
      handler,
      modifiers,
    });
    const dispose = listen(node, event, handler, options);
    return () => {
      dispatch_dev("SvelteDOMRemoveEventListener", {
        node,
        event,
        handler,
        modifiers,
      });
      dispose();
    };
  }
  function attr_dev(node, attribute, value) {
    attr(node, attribute, value);
    if (value == null)
      dispatch_dev("SvelteDOMRemoveAttribute", { node, attribute });
    else dispatch_dev("SvelteDOMSetAttribute", { node, attribute, value });
  }
  function prop_dev(node, property, value) {
    node[property] = value;
    dispatch_dev("SvelteDOMSetProperty", { node, property, value });
  }
  function set_data_dev(text, data) {
    data = "" + data;
    if (text.wholeText === data) return;
    dispatch_dev("SvelteDOMSetData", { node: text, data });
    text.data = data;
  }
  function validate_slots(name, slot, keys) {
    for (const slot_key of Object.keys(slot)) {
      if (!~keys.indexOf(slot_key)) {
        console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
      }
    }
  }
  /**
   * Base class for Svelte components with some minor dev-enhancements. Used when dev=true.
   */
  class SvelteComponentDev extends SvelteComponent {
    constructor(options) {
      if (!options || (!options.target && !options.$$inline)) {
        throw new Error("'target' is a required option");
      }
      super();
    }
    $destroy() {
      super.$destroy();
      this.$destroy = () => {
        console.warn("Component was already destroyed"); // eslint-disable-line no-console
      };
    }
    $capture_state() {}
    $inject_state() {}
  }

  /*
   * Adapted from https://github.com/reach/router/blob/b60e6dd781d5d3a4bdaaf4de665649c0f6a7e78d/src/lib/utils.js
   *
   * https://github.com/reach/router/blob/master/LICENSE
   */

  const isUndefined = (value) => typeof value === "undefined";

  const isFunction = (value) => typeof value === "function";

  const isNumber = (value) => typeof value === "number";

  /**
   * Decides whether a given `event` should result in a navigation or not.
   * @param {object} event
   */
  function shouldNavigate(event) {
    return (
      !event.defaultPrevented &&
      event.button === 0 &&
      !(event.metaKey || event.altKey || event.ctrlKey || event.shiftKey)
    );
  }

  function createCounter() {
    let i = 0;
    /**
     * Returns an id and increments the internal state
     * @returns {number}
     */
    return () => i++;
  }

  /**
   * Create a globally unique id
   *
   * @returns {string} An id
   */
  function createGlobalId() {
    return Math.random().toString(36).substring(2);
  }

  const isSSR = typeof window === "undefined";

  function addListener(target, type, handler) {
    target.addEventListener(type, handler);
    return () => target.removeEventListener(type, handler);
  }

  const subscriber_queue = [];
  /**
   * Creates a `Readable` store that allows reading by subscription.
   * @param value initial value
   * @param {StartStopNotifier}start start and stop notifications for subscriptions
   */
  function readable(value, start) {
    return {
      subscribe: writable(value, start).subscribe,
    };
  }
  /**
   * Create a `Writable` store that allows both updating and reading by subscription.
   * @param {*=}value initial value
   * @param {StartStopNotifier=}start start and stop notifications for subscriptions
   */
  function writable(value, start = noop) {
    let stop;
    const subscribers = new Set();
    function set(new_value) {
      if (safe_not_equal(value, new_value)) {
        value = new_value;
        if (stop) {
          // store is ready
          const run_queue = !subscriber_queue.length;
          for (const subscriber of subscribers) {
            subscriber[1]();
            subscriber_queue.push(subscriber, value);
          }
          if (run_queue) {
            for (let i = 0; i < subscriber_queue.length; i += 2) {
              subscriber_queue[i][0](subscriber_queue[i + 1]);
            }
            subscriber_queue.length = 0;
          }
        }
      }
    }
    function update(fn) {
      set(fn(value));
    }
    function subscribe(run, invalidate = noop) {
      const subscriber = [run, invalidate];
      subscribers.add(subscriber);
      if (subscribers.size === 1) {
        stop = start(set) || noop;
      }
      run(value);
      return () => {
        subscribers.delete(subscriber);
        if (subscribers.size === 0) {
          stop();
          stop = null;
        }
      };
    }
    return { set, update, subscribe };
  }
  function derived(stores, fn, initial_value) {
    const single = !Array.isArray(stores);
    const stores_array = single ? [stores] : stores;
    const auto = fn.length < 2;
    return readable(initial_value, (set) => {
      let inited = false;
      const values = [];
      let pending = 0;
      let cleanup = noop;
      const sync = () => {
        if (pending) {
          return;
        }
        cleanup();
        const result = fn(single ? values[0] : values, set);
        if (auto) {
          set(result);
        } else {
          cleanup = is_function(result) ? result : noop;
        }
      };
      const unsubscribers = stores_array.map((store, i) =>
        subscribe(
          store,
          (value) => {
            values[i] = value;
            pending &= ~(1 << i);
            if (inited) {
              sync();
            }
          },
          () => {
            pending |= 1 << i;
          }
        )
      );
      inited = true;
      sync();
      return function stop() {
        run_all(unsubscribers);
        cleanup();
      };
    });
  }

  /*
   * Adapted from https://github.com/EmilTholin/svelte-routing
   *
   * https://github.com/EmilTholin/svelte-routing/blob/master/LICENSE
   */

  const createKey = (ctxName) => `@@svnav-ctx__${ctxName}`;

  // Use strings instead of objects, so different versions of
  // svelte-navigator can potentially still work together
  const LOCATION = createKey("LOCATION");
  const ROUTER = createKey("ROUTER");
  const ROUTE = createKey("ROUTE");
  const ROUTE_PARAMS = createKey("ROUTE_PARAMS");
  const FOCUS_ELEM = createKey("FOCUS_ELEM");

  const paramRegex = /^:(.+)/;

  /**
   * Check if `string` starts with `search`
   * @param {string} string
   * @param {string} search
   * @return {boolean}
   */
  const startsWith = (string, search) =>
    string.substr(0, search.length) === search;

  /**
   * Check if `segment` is a root segment
   * @param {string} segment
   * @return {boolean}
   */
  const isRootSegment = (segment) => segment === "";

  /**
   * Check if `segment` is a dynamic segment
   * @param {string} segment
   * @return {boolean}
   */
  const isDynamic = (segment) => paramRegex.test(segment);

  /**
   * Check if `segment` is a splat
   * @param {string} segment
   * @return {boolean}
   */
  const isSplat = (segment) => segment[0] === "*";

  /**
   * Strip potention splat and splatname of the end of a path
   * @param {string} str
   * @return {string}
   */
  const stripSplat = (str) => str.replace(/\*.*$/, "");

  /**
   * Strip `str` of potential start and end `/`
   * @param {string} str
   * @return {string}
   */
  const stripSlashes = (str) => str.replace(/(^\/+|\/+$)/g, "");

  /**
   * Split up the URI into segments delimited by `/`
   * @param {string} uri
   * @return {string[]}
   */
  function segmentize(uri, filterFalsy = false) {
    const segments = stripSlashes(uri).split("/");
    return filterFalsy ? segments.filter(Boolean) : segments;
  }

  /**
   * Add the query to the pathname if a query is given
   * @param {string} pathname
   * @param {string} [query]
   * @return {string}
   */
  const addQuery = (pathname, query) => pathname + (query ? `?${query}` : "");

  /**
   * Normalizes a basepath
   *
   * @param {string} path
   * @returns {string}
   *
   * @example
   * normalizePath("base/path/") // -> "/base/path"
   */
  const normalizePath = (path) => `/${stripSlashes(path)}`;

  /**
   * Joins and normalizes multiple path fragments
   *
   * @param {...string} pathFragments
   * @returns {string}
   */
  function join(...pathFragments) {
    const joinFragment = (fragment) => segmentize(fragment, true).join("/");
    const joinedSegments = pathFragments.map(joinFragment).join("/");
    return normalizePath(joinedSegments);
  }

  // We start from 1 here, so we can check if an origin id has been passed
  // by using `originId || <fallback>`
  const LINK_ID = 1;
  const ROUTE_ID = 2;
  const ROUTER_ID = 3;
  const USE_FOCUS_ID = 4;
  const USE_LOCATION_ID = 5;
  const USE_MATCH_ID = 6;
  const USE_NAVIGATE_ID = 7;
  const USE_PARAMS_ID = 8;
  const USE_RESOLVABLE_ID = 9;
  const USE_RESOLVE_ID = 10;
  const NAVIGATE_ID = 11;

  const labels = {
    [LINK_ID]: "Link",
    [ROUTE_ID]: "Route",
    [ROUTER_ID]: "Router",
    [USE_FOCUS_ID]: "useFocus",
    [USE_LOCATION_ID]: "useLocation",
    [USE_MATCH_ID]: "useMatch",
    [USE_NAVIGATE_ID]: "useNavigate",
    [USE_PARAMS_ID]: "useParams",
    [USE_RESOLVABLE_ID]: "useResolvable",
    [USE_RESOLVE_ID]: "useResolve",
    [NAVIGATE_ID]: "navigate",
  };

  const createLabel = (labelId) => labels[labelId];

  function createIdentifier(labelId, props) {
    let attr;
    if (labelId === ROUTE_ID) {
      attr = props.path ? `path="${props.path}"` : "default";
    } else if (labelId === LINK_ID) {
      attr = `to="${props.to}"`;
    } else if (labelId === ROUTER_ID) {
      attr = `basepath="${props.basepath || ""}"`;
    }
    return `<${createLabel(labelId)} ${attr || ""} />`;
  }

  function createMessage(labelId, message, props, originId) {
    const origin = props && createIdentifier(originId || labelId, props);
    const originMsg = origin ? `\n\nOccurred in: ${origin}` : "";
    const label = createLabel(labelId);
    const msg = isFunction(message) ? message(label) : message;
    return `<${label}> ${msg}${originMsg}`;
  }

  const createMessageHandler = (handler) => (...args) =>
    handler(createMessage(...args));

  const fail = createMessageHandler((message) => {
    throw new Error(message);
  });

  // eslint-disable-next-line no-console
  const warn = createMessageHandler(console.warn);

  const SEGMENT_POINTS = 4;
  const STATIC_POINTS = 3;
  const DYNAMIC_POINTS = 2;
  const SPLAT_PENALTY = 1;
  const ROOT_POINTS = 1;

  /**
   * Score a route depending on how its individual segments look
   * @param {object} route
   * @param {number} index
   * @return {object}
   */
  function rankRoute(route, index) {
    const score = route.default
      ? 0
      : segmentize(route.fullPath).reduce((acc, segment) => {
          let nextScore = acc;
          nextScore += SEGMENT_POINTS;

          if (isRootSegment(segment)) {
            nextScore += ROOT_POINTS;
          } else if (isDynamic(segment)) {
            nextScore += DYNAMIC_POINTS;
          } else if (isSplat(segment)) {
            nextScore -= SEGMENT_POINTS + SPLAT_PENALTY;
          } else {
            nextScore += STATIC_POINTS;
          }

          return nextScore;
        }, 0);

    return { route, score, index };
  }

  /**
   * Give a score to all routes and sort them on that
   * @param {object[]} routes
   * @return {object[]}
   */
  function rankRoutes(routes) {
    return (
      routes
        .map(rankRoute)
        // If two routes have the exact same score, we go by index instead
        .sort((a, b) => {
          if (a.score < b.score) {
            return 1;
          }
          if (a.score > b.score) {
            return -1;
          }
          return a.index - b.index;
        })
    );
  }

  /**
   * Ranks and picks the best route to match. Each segment gets the highest
   * amount of points, then the type of segment gets an additional amount of
   * points where
   *
   *  static > dynamic > splat > root
   *
   * This way we don't have to worry about the order of our routes, let the
   * computers do it.
   *
   * A route looks like this
   *
   *  { fullPath, default, value }
   *
   * And a returned match looks like:
   *
   *  { route, params, uri }
   *
   * @param {object[]} routes
   * @param {string} uri
   * @return {?object}
   */
  function pick(routes, uri) {
    let bestMatch;
    let defaultMatch;

    const [uriPathname] = uri.split("?");
    const uriSegments = segmentize(uriPathname);
    const isRootUri = uriSegments[0] === "";
    const ranked = rankRoutes(routes);

    for (let i = 0, l = ranked.length; i < l; i++) {
      const { route } = ranked[i];
      let missed = false;
      const params = {};

      // eslint-disable-next-line no-shadow
      const createMatch = (uri) => ({ ...route, params, uri });

      if (route.default) {
        defaultMatch = createMatch(uri);
        continue;
      }

      const routeSegments = segmentize(route.fullPath);
      const max = Math.max(uriSegments.length, routeSegments.length);
      let index = 0;

      for (; index < max; index++) {
        const routeSegment = routeSegments[index];
        const uriSegment = uriSegments[index];

        if (!isUndefined(routeSegment) && isSplat(routeSegment)) {
          // Hit a splat, just grab the rest, and return a match
          // uri:   /files/documents/work
          // route: /files/* or /files/*splatname
          const splatName = routeSegment === "*" ? "*" : routeSegment.slice(1);

          params[splatName] = uriSegments
            .slice(index)
            .map(decodeURIComponent)
            .join("/");
          break;
        }

        if (isUndefined(uriSegment)) {
          // URI is shorter than the route, no match
          // uri:   /users
          // route: /users/:userId
          missed = true;
          break;
        }

        const dynamicMatch = paramRegex.exec(routeSegment);

        if (dynamicMatch && !isRootUri) {
          const value = decodeURIComponent(uriSegment);
          params[dynamicMatch[1]] = value;
        } else if (routeSegment !== uriSegment) {
          // Current segments don't match, not dynamic, not splat, so no match
          // uri:   /users/123/settings
          // route: /users/:id/profile
          missed = true;
          break;
        }
      }

      if (!missed) {
        bestMatch = createMatch(join(...uriSegments.slice(0, index)));
        break;
      }
    }

    return bestMatch || defaultMatch || null;
  }

  /**
   * Check if the `route.fullPath` matches the `uri`.
   * @param {Object} route
   * @param {string} uri
   * @return {?object}
   */
  function match(route, uri) {
    return pick([route], uri);
  }

  /**
   * Resolve URIs as though every path is a directory, no files. Relative URIs
   * in the browser can feel awkward because not only can you be "in a directory",
   * you can be "at a file", too. For example:
   *
   *  browserSpecResolve('foo', '/bar/') => /bar/foo
   *  browserSpecResolve('foo', '/bar') => /foo
   *
   * But on the command line of a file system, it's not as complicated. You can't
   * `cd` from a file, only directories. This way, links have to know less about
   * their current path. To go deeper you can do this:
   *
   *  <Link to="deeper"/>
   *  // instead of
   *  <Link to=`{${props.uri}/deeper}`/>
   *
   * Just like `cd`, if you want to go deeper from the command line, you do this:
   *
   *  cd deeper
   *  # not
   *  cd $(pwd)/deeper
   *
   * By treating every path as a directory, linking to relative paths should
   * require less contextual information and (fingers crossed) be more intuitive.
   * @param {string} to
   * @param {string} base
   * @return {string}
   */
  function resolve(to, base) {
    // /foo/bar, /baz/qux => /foo/bar
    if (startsWith(to, "/")) {
      return to;
    }

    const [toPathname, toQuery] = to.split("?");
    const [basePathname] = base.split("?");
    const toSegments = segmentize(toPathname);
    const baseSegments = segmentize(basePathname);

    // ?a=b, /users?b=c => /users?a=b
    if (toSegments[0] === "") {
      return addQuery(basePathname, toQuery);
    }

    // profile, /users/789 => /users/789/profile
    if (!startsWith(toSegments[0], ".")) {
      const pathname = baseSegments.concat(toSegments).join("/");
      return addQuery((basePathname === "/" ? "" : "/") + pathname, toQuery);
    }

    // ./       , /users/123 => /users/123
    // ../      , /users/123 => /users
    // ../..    , /users/123 => /
    // ../../one, /a/b/c/d   => /a/b/one
    // .././one , /a/b/c/d   => /a/b/c/one
    const allSegments = baseSegments.concat(toSegments);
    const segments = [];

    allSegments.forEach((segment) => {
      if (segment === "..") {
        segments.pop();
      } else if (segment !== ".") {
        segments.push(segment);
      }
    });

    return addQuery(`/${segments.join("/")}`, toQuery);
  }

  /**
   * Normalizes a location for consumption by `Route` children and the `Router`.
   * It removes the apps basepath from the pathname
   * and sets default values for `search` and `hash` properties.
   *
   * @param {Object} location The current global location supplied by the history component
   * @param {string} basepath The applications basepath (i.e. when serving from a subdirectory)
   *
   * @returns The normalized location
   */
  function normalizeLocation(location, basepath) {
    const { pathname, hash = "", search = "", state } = location;
    const baseSegments = segmentize(basepath, true);
    const pathSegments = segmentize(pathname, true);
    while (baseSegments.length) {
      if (baseSegments[0] !== pathSegments[0]) {
        fail(
          ROUTER_ID,
          `Invalid state: All locations must begin with the basepath "${basepath}", found "${pathname}"`
        );
      }
      baseSegments.shift();
      pathSegments.shift();
    }
    return {
      pathname: join(...pathSegments),
      hash,
      search,
      state,
    };
  }

  const normalizeUrlFragment = (frag) => (frag.length === 1 ? "" : frag);

  /**
   * Creates a location object from an url.
   * It is used to create a location from the url prop used in SSR
   *
   * @param {string} url The url string (e.g. "/path/to/somewhere")
   *
   * @returns {{ pathname: string; search: string; hash: string }} The location
   */
  function createLocation(url) {
    const searchIndex = url.indexOf("?");
    const hashIndex = url.indexOf("#");
    const hasSearchIndex = searchIndex !== -1;
    const hasHashIndex = hashIndex !== -1;
    const hash = hasHashIndex
      ? normalizeUrlFragment(url.substr(hashIndex))
      : "";
    const pathnameAndSearch = hasHashIndex ? url.substr(0, hashIndex) : url;
    const search = hasSearchIndex
      ? normalizeUrlFragment(pathnameAndSearch.substr(searchIndex))
      : "";
    const pathname = hasSearchIndex
      ? pathnameAndSearch.substr(0, searchIndex)
      : pathnameAndSearch;
    return { pathname, search, hash };
  }

  /**
   * Resolves a link relative to the parent Route and the Routers basepath.
   *
   * @param {string} path The given path, that will be resolved
   * @param {string} routeBase The current Routes base path
   * @param {string} appBase The basepath of the app. Used, when serving from a subdirectory
   * @returns {string} The resolved path
   *
   * @example
   * resolveLink("relative", "/routeBase", "/") // -> "/routeBase/relative"
   * resolveLink("/absolute", "/routeBase", "/") // -> "/absolute"
   * resolveLink("relative", "/routeBase", "/base") // -> "/base/routeBase/relative"
   * resolveLink("/absolute", "/routeBase", "/base") // -> "/base/absolute"
   */
  function resolveLink(path, routeBase, appBase) {
    return join(appBase, resolve(path, routeBase));
  }

  /**
   * Get the uri for a Route, by matching it against the current location.
   *
   * @param {string} routePath The Routes resolved path
   * @param {string} pathname The current locations pathname
   */
  function extractBaseUri(routePath, pathname) {
    const fullPath = normalizePath(stripSplat(routePath));
    const baseSegments = segmentize(fullPath, true);
    const pathSegments = segmentize(pathname, true).slice(
      0,
      baseSegments.length
    );
    const routeMatch = match({ fullPath }, join(...pathSegments));
    return routeMatch && routeMatch.uri;
  }

  /*
   * Adapted from https://github.com/reach/router/blob/b60e6dd781d5d3a4bdaaf4de665649c0f6a7e78d/src/lib/history.js
   *
   * https://github.com/reach/router/blob/master/LICENSE
   */

  const POP = "POP";
  const PUSH = "PUSH";
  const REPLACE = "REPLACE";

  function getLocation(source) {
    return {
      ...source.location,
      pathname: encodeURI(decodeURI(source.location.pathname)),
      state: source.history.state,
      _key: (source.history.state && source.history.state._key) || "initial",
    };
  }

  function createHistory(source) {
    let listeners = [];
    let location = getLocation(source);
    let action = POP;

    const notifyListeners = (listenerFns = listeners) =>
      listenerFns.forEach((listener) => listener({ location, action }));

    return {
      get location() {
        return location;
      },
      listen(listener) {
        listeners.push(listener);

        const popstateListener = () => {
          location = getLocation(source);
          action = POP;
          notifyListeners([listener]);
        };

        // Call listener when it is registered
        notifyListeners([listener]);

        const unlisten = addListener(source, "popstate", popstateListener);
        return () => {
          unlisten();
          listeners = listeners.filter((fn) => fn !== listener);
        };
      },
      /**
       * Navigate to a new absolute route.
       *
       * @param {string|number} to The path to navigate to.
       *
       * If `to` is a number we will navigate to the stack entry index + `to`
       * (-> `navigate(-1)`, is equivalent to hitting the back button of the browser)
       * @param {Object} options
       * @param {*} [options.state] The state will be accessible through `location.state`
       * @param {boolean} [options.replace=false] Replace the current entry in the history
       * stack, instead of pushing on a new one
       */
      navigate(to, options) {
        const { state = {}, replace = false } = options || {};
        action = replace ? REPLACE : PUSH;
        if (isNumber(to)) {
          if (options) {
            warn(
              NAVIGATE_ID,
              "Navigation options (state or replace) are not supported, " +
                "when passing a number as the first argument to navigate. " +
                "They are ignored."
            );
          }
          action = POP;
          source.history.go(to);
        } else {
          const keyedState = { ...state, _key: createGlobalId() };
          // try...catch iOS Safari limits to 100 pushState calls
          try {
            source.history[replace ? "replaceState" : "pushState"](
              keyedState,
              "",
              to
            );
          } catch (e) {
            source.location[replace ? "replace" : "assign"](to);
          }
        }

        location = getLocation(source);
        notifyListeners();
      },
    };
  }

  function createStackFrame(state, uri) {
    return { ...createLocation(uri), state };
  }

  // Stores history entries in memory for testing or other platforms like Native
  function createMemorySource(initialPathname = "/") {
    let index = 0;
    let stack = [createStackFrame(null, initialPathname)];

    return {
      // This is just for testing...
      get entries() {
        return stack;
      },
      get location() {
        return stack[index];
      },
      addEventListener() {},
      removeEventListener() {},
      history: {
        get state() {
          return stack[index].state;
        },
        pushState(state, title, uri) {
          index++;
          // Throw away anything in the stack with an index greater than the current index.
          // This happens, when we go back using `go(-n)`. The index is now less than `stack.length`.
          // If we call `go(+n)` the stack entries with an index greater than the current index can
          // be reused.
          // However, if we navigate to a path, instead of a number, we want to create a new branch
          // of navigation.
          stack = stack.slice(0, index);
          stack.push(createStackFrame(state, uri));
        },
        replaceState(state, title, uri) {
          stack[index] = createStackFrame(state, uri);
        },
        go(to) {
          const newIndex = index + to;
          if (newIndex < 0 || newIndex > stack.length - 1) {
            return;
          }
          index = newIndex;
        },
      },
    };
  }

  // Global history uses window.history as the source if available,
  // otherwise a memory history
  const canUseDOM = !!(
    !isSSR &&
    window.document &&
    window.document.createElement
  );
  // Use memory history in iframes (for example in Svelte REPL)
  const isEmbeddedPage = !isSSR && window.location.origin === "null";
  const globalHistory = createHistory(
    canUseDOM && !isEmbeddedPage ? window : createMemorySource()
  );

  // We need to keep the focus candidate in a separate file, so svelte does
  // not update, when we mutate it.
  // Also, we need a single global reference, because taking focus needs to
  // work globally, even if we have multiple top level routers
  // eslint-disable-next-line import/no-mutable-exports
  let focusCandidate = null;

  // eslint-disable-next-line import/no-mutable-exports
  let initialNavigation = true;

  /**
   * Check if RouterA is above RouterB in the document
   * @param {number} routerIdA The first Routers id
   * @param {number} routerIdB The second Routers id
   */
  function isAbove(routerIdA, routerIdB) {
    const routerMarkers = document.querySelectorAll("[data-svnav-router]");
    for (let i = 0; i < routerMarkers.length; i++) {
      const node = routerMarkers[i];
      const currentId = Number(node.dataset.svnavRouter);
      if (currentId === routerIdA) return true;
      if (currentId === routerIdB) return false;
    }
    return false;
  }

  /**
     * Check if a Route candidate is the best choice to move focus to,
     * and store the best match.
     * @param {{
         level: number;
         routerId: number;
         route: {
           id: number;
           focusElement: import("svelte/store").Readable<Promise<Element>|null>;
         }
       }} item A Route candidate, that updated and is visible after a navigation
     */
  function pushFocusCandidate(item) {
    if (
      // Best candidate if it's the only candidate...
      !focusCandidate ||
      // Route is nested deeper, than previous candidate
      // -> Route change was triggered in the deepest affected
      // Route, so that's were focus should move to
      item.level > focusCandidate.level ||
      // If the level is identical, we want to focus the first Route in the document,
      // so we pick the first Router lookin from page top to page bottom.
      (item.level === focusCandidate.level &&
        isAbove(item.routerId, focusCandidate.routerId))
    ) {
      focusCandidate = item;
    }
  }

  /**
   * Reset the focus candidate.
   */
  function clearFocusCandidate() {
    focusCandidate = null;
  }

  function initialNavigationOccurred() {
    initialNavigation = false;
  }

  /*
   * `focus` Adapted from https://github.com/oaf-project/oaf-side-effects/blob/master/src/index.ts
   *
   * https://github.com/oaf-project/oaf-side-effects/blob/master/LICENSE
   */
  function focus(elem) {
    if (!elem) return false;
    const TABINDEX = "tabindex";
    try {
      if (!elem.hasAttribute(TABINDEX)) {
        elem.setAttribute(TABINDEX, "-1");
        let unlisten;
        // We remove tabindex after blur to avoid weird browser behavior
        // where a mouse click can activate elements with tabindex="-1".
        const blurListener = () => {
          elem.removeAttribute(TABINDEX);
          unlisten();
        };
        unlisten = addListener(elem, "blur", blurListener);
      }
      elem.focus();
      return document.activeElement === elem;
    } catch (e) {
      // Apparently trying to focus a disabled element in IE can throw.
      // See https://stackoverflow.com/a/1600194/2476884
      return false;
    }
  }

  function isEndMarker(elem, id) {
    return Number(elem.dataset.svnavRouteEnd) === id;
  }

  function isHeading(elem) {
    return /^H[1-6]$/i.test(elem.tagName);
  }

  function query(selector, parent = document) {
    return parent.querySelector(selector);
  }

  function queryHeading(id) {
    const marker = query(`[data-svnav-route-start="${id}"]`);
    let current = marker.nextElementSibling;
    while (!isEndMarker(current, id)) {
      if (isHeading(current)) {
        return current;
      }
      const heading = query("h1,h2,h3,h4,h5,h6", current);
      if (heading) {
        return heading;
      }
      current = current.nextElementSibling;
    }
    return null;
  }

  function handleFocus(route) {
    Promise.resolve(get_store_value(route.focusElement)).then((elem) => {
      const focusElement = elem || queryHeading(route.id);
      if (!focusElement) {
        warn(
          ROUTER_ID,
          "Could not find an element to focus. " +
            "You should always render a header for accessibility reasons, " +
            'or set a custom focus element via the "useFocus" hook. ' +
            "If you don't want this Route or Router to manage focus, " +
            'pass "primary={false}" to it.',
          route,
          ROUTE_ID
        );
      }
      const headingFocused = focus(focusElement);
      if (headingFocused) return;
      focus(document.documentElement);
    });
  }

  const createTriggerFocus = (a11yConfig, announcementText, location) => (
    manageFocus,
    announceNavigation
  ) =>
    // Wait until the dom is updated, so we can look for headings
    tick().then(() => {
      if (!focusCandidate || initialNavigation) {
        initialNavigationOccurred();
        return;
      }
      if (manageFocus) {
        handleFocus(focusCandidate.route);
      }
      if (a11yConfig.announcements && announceNavigation) {
        const { path, fullPath, meta, params, uri } = focusCandidate.route;
        const announcementMessage = a11yConfig.createAnnouncement(
          { path, fullPath, meta, params, uri },
          get_store_value(location)
        );
        Promise.resolve(announcementMessage).then((message) => {
          announcementText.set(message);
        });
      }
      clearFocusCandidate();
    });

  const visuallyHiddenStyle =
    "position:fixed;" +
    "top:-1px;" +
    "left:0;" +
    "width:1px;" +
    "height:1px;" +
    "padding:0;" +
    "overflow:hidden;" +
    "clip:rect(0,0,0,0);" +
    "white-space:nowrap;" +
    "border:0;";

  /* node_modules/svelte-navigator/src/Router.svelte generated by Svelte v3.42.1 */

  const file$b = "node_modules/svelte-navigator/src/Router.svelte";

  // (195:0) {#if isTopLevelRouter && manageFocus && a11yConfig.announcements}
  function create_if_block$4(ctx) {
    let div;
    let t;

    const block = {
      c: function create() {
        div = element("div");
        t = text(/*$announcementText*/ ctx[0]);
        attr_dev(div, "role", "status");
        attr_dev(div, "aria-atomic", "true");
        attr_dev(div, "aria-live", "polite");
        attr_dev(div, "style", visuallyHiddenStyle);
        add_location(div, file$b, 195, 1, 5906);
      },
      m: function mount(target, anchor) {
        insert_dev(target, div, anchor);
        append_dev(div, t);
      },
      p: function update(ctx, dirty) {
        if (dirty[0] & /*$announcementText*/ 1)
          set_data_dev(t, /*$announcementText*/ ctx[0]);
      },
      d: function destroy(detaching) {
        if (detaching) detach_dev(div);
      },
    };

    dispatch_dev("SvelteRegisterBlock", {
      block,
      id: create_if_block$4.name,
      type: "if",
      source:
        "(195:0) {#if isTopLevelRouter && manageFocus && a11yConfig.announcements}",
      ctx,
    });

    return block;
  }

  function create_fragment$b(ctx) {
    let div;
    let t0;
    let t1;
    let if_block_anchor;
    let current;
    const default_slot_template = /*#slots*/ ctx[20].default;
    const default_slot = create_slot(
      default_slot_template,
      ctx,
      /*$$scope*/ ctx[19],
      null
    );
    let if_block =
      /*isTopLevelRouter*/ ctx[2] &&
      /*manageFocus*/ ctx[4] &&
      /*a11yConfig*/ ctx[1].announcements &&
      create_if_block$4(ctx);

    const block = {
      c: function create() {
        div = element("div");
        t0 = space();
        if (default_slot) default_slot.c();
        t1 = space();
        if (if_block) if_block.c();
        if_block_anchor = empty();
        set_style(div, "display", "none");
        attr_dev(div, "aria-hidden", "true");
        attr_dev(div, "data-svnav-router", /*routerId*/ ctx[3]);
        add_location(div, file$b, 190, 0, 5750);
      },
      l: function claim(nodes) {
        throw new Error(
          "options.hydrate only works if the component was compiled with the `hydratable: true` option"
        );
      },
      m: function mount(target, anchor) {
        insert_dev(target, div, anchor);
        insert_dev(target, t0, anchor);

        if (default_slot) {
          default_slot.m(target, anchor);
        }

        insert_dev(target, t1, anchor);
        if (if_block) if_block.m(target, anchor);
        insert_dev(target, if_block_anchor, anchor);
        current = true;
      },
      p: function update(ctx, dirty) {
        if (default_slot) {
          if (default_slot.p && (!current || dirty[0] & /*$$scope*/ 524288)) {
            update_slot_base(
              default_slot,
              default_slot_template,
              ctx,
              /*$$scope*/ ctx[19],
              !current
                ? get_all_dirty_from_scope(/*$$scope*/ ctx[19])
                : get_slot_changes(
                    default_slot_template,
                    /*$$scope*/ ctx[19],
                    dirty,
                    null
                  ),
              null
            );
          }
        }

        if (
          /*isTopLevelRouter*/ ctx[2] &&
          /*manageFocus*/ ctx[4] &&
          /*a11yConfig*/ ctx[1].announcements
        )
          if_block.p(ctx, dirty);
      },
      i: function intro(local) {
        if (current) return;
        transition_in(default_slot, local);
        current = true;
      },
      o: function outro(local) {
        transition_out(default_slot, local);
        current = false;
      },
      d: function destroy(detaching) {
        if (detaching) detach_dev(div);
        if (detaching) detach_dev(t0);
        if (default_slot) default_slot.d(detaching);
        if (detaching) detach_dev(t1);
        if (if_block) if_block.d(detaching);
        if (detaching) detach_dev(if_block_anchor);
      },
    };

    dispatch_dev("SvelteRegisterBlock", {
      block,
      id: create_fragment$b.name,
      type: "component",
      source: "",
      ctx,
    });

    return block;
  }

  const createId$1 = createCounter();
  const defaultBasepath = "/";

  function instance$b($$self, $$props, $$invalidate) {
    let $location;
    let $activeRoute;
    let $prevLocation;
    let $routes;
    let $announcementText;
    let { $$slots: slots = {}, $$scope } = $$props;
    validate_slots("Router", slots, ["default"]);
    let { basepath = defaultBasepath } = $$props;
    let { url = null } = $$props;
    let { history = globalHistory } = $$props;
    let { primary = true } = $$props;
    let { a11y = {} } = $$props;

    const a11yConfig = {
      createAnnouncement: (route) => `Navigated to ${route.uri}`,
      announcements: true,
      ...a11y,
    };

    // Remember the initial `basepath`, so we can fire a warning
    // when the user changes it later
    const initialBasepath = basepath;

    const normalizedBasepath = normalizePath(basepath);
    const locationContext = getContext(LOCATION);
    const routerContext = getContext(ROUTER);
    const isTopLevelRouter = !locationContext;
    const routerId = createId$1();
    const manageFocus =
      primary && !(routerContext && !routerContext.manageFocus);
    const announcementText = writable("");
    validate_store(announcementText, "announcementText");
    component_subscribe($$self, announcementText, (value) =>
      $$invalidate(0, ($announcementText = value))
    );
    const routes = writable([]);
    validate_store(routes, "routes");
    component_subscribe($$self, routes, (value) =>
      $$invalidate(18, ($routes = value))
    );
    const activeRoute = writable(null);
    validate_store(activeRoute, "activeRoute");
    component_subscribe($$self, activeRoute, (value) =>
      $$invalidate(16, ($activeRoute = value))
    );

    // Used in SSR to synchronously set that a Route is active.
    let hasActiveRoute = false;

    // Nesting level of router.
    // We will need this to identify sibling routers, when moving
    // focus on navigation, so we can focus the first possible router
    const level = isTopLevelRouter ? 0 : routerContext.level + 1;

    // If we're running an SSR we force the location to the `url` prop
    const getInitialLocation = () =>
      normalizeLocation(
        isSSR ? createLocation(url) : history.location,
        normalizedBasepath
      );

    const location = isTopLevelRouter
      ? writable(getInitialLocation())
      : locationContext;

    validate_store(location, "location");
    component_subscribe($$self, location, (value) =>
      $$invalidate(15, ($location = value))
    );
    const prevLocation = writable($location);
    validate_store(prevLocation, "prevLocation");
    component_subscribe($$self, prevLocation, (value) =>
      $$invalidate(17, ($prevLocation = value))
    );
    const triggerFocus = createTriggerFocus(
      a11yConfig,
      announcementText,
      location
    );
    const createRouteFilter = (routeId) => (routeList) =>
      routeList.filter((routeItem) => routeItem.id !== routeId);

    function registerRoute(route) {
      if (isSSR) {
        // In SSR we should set the activeRoute immediately if it is a match.
        // If there are more Routes being registered after a match is found,
        // we just skip them.
        if (hasActiveRoute) {
          return;
        }

        const matchingRoute = match(route, $location.pathname);

        if (matchingRoute) {
          hasActiveRoute = true;

          // Return the match in SSR mode, so the matched Route can use it immediatly.
          // Waiting for activeRoute to update does not work, because it updates
          // after the Route is initialized
          return matchingRoute; // eslint-disable-line consistent-return
        }
      } else {
        routes.update((prevRoutes) => {
          // Remove an old version of the updated route,
          // before pushing the new version
          const nextRoutes = createRouteFilter(route.id)(prevRoutes);

          nextRoutes.push(route);
          return nextRoutes;
        });
      }
    }

    function unregisterRoute(routeId) {
      routes.update(createRouteFilter(routeId));
    }

    if (!isTopLevelRouter && basepath !== defaultBasepath) {
      warn(
        ROUTER_ID,
        'Only top-level Routers can have a "basepath" prop. It is ignored.',
        { basepath }
      );
    }

    if (isTopLevelRouter) {
      // The topmost Router in the tree is responsible for updating
      // the location store and supplying it through context.
      onMount(() => {
        const unlisten = history.listen((changedHistory) => {
          const normalizedLocation = normalizeLocation(
            changedHistory.location,
            normalizedBasepath
          );
          prevLocation.set($location);
          location.set(normalizedLocation);
        });

        return unlisten;
      });

      setContext(LOCATION, location);
    }

    setContext(ROUTER, {
      activeRoute,
      registerRoute,
      unregisterRoute,
      manageFocus,
      level,
      id: routerId,
      history: isTopLevelRouter ? history : routerContext.history,
      basepath: isTopLevelRouter ? normalizedBasepath : routerContext.basepath,
    });

    const writable_props = ["basepath", "url", "history", "primary", "a11y"];

    Object.keys($$props).forEach((key) => {
      if (
        !~writable_props.indexOf(key) &&
        key.slice(0, 2) !== "$$" &&
        key !== "slot"
      )
        console.warn(`<Router> was created with unknown prop '${key}'`);
    });

    $$self.$$set = ($$props) => {
      if ("basepath" in $$props)
        $$invalidate(10, (basepath = $$props.basepath));
      if ("url" in $$props) $$invalidate(11, (url = $$props.url));
      if ("history" in $$props) $$invalidate(12, (history = $$props.history));
      if ("primary" in $$props) $$invalidate(13, (primary = $$props.primary));
      if ("a11y" in $$props) $$invalidate(14, (a11y = $$props.a11y));
      if ("$$scope" in $$props) $$invalidate(19, ($$scope = $$props.$$scope));
    };

    $$self.$capture_state = () => ({
      createCounter,
      createId: createId$1,
      getContext,
      setContext,
      onMount,
      writable,
      LOCATION,
      ROUTER,
      globalHistory,
      normalizePath,
      pick,
      match,
      normalizeLocation,
      createLocation,
      isSSR,
      warn,
      ROUTER_ID,
      pushFocusCandidate,
      visuallyHiddenStyle,
      createTriggerFocus,
      defaultBasepath,
      basepath,
      url,
      history,
      primary,
      a11y,
      a11yConfig,
      initialBasepath,
      normalizedBasepath,
      locationContext,
      routerContext,
      isTopLevelRouter,
      routerId,
      manageFocus,
      announcementText,
      routes,
      activeRoute,
      hasActiveRoute,
      level,
      getInitialLocation,
      location,
      prevLocation,
      triggerFocus,
      createRouteFilter,
      registerRoute,
      unregisterRoute,
      $location,
      $activeRoute,
      $prevLocation,
      $routes,
      $announcementText,
    });

    $$self.$inject_state = ($$props) => {
      if ("basepath" in $$props)
        $$invalidate(10, (basepath = $$props.basepath));
      if ("url" in $$props) $$invalidate(11, (url = $$props.url));
      if ("history" in $$props) $$invalidate(12, (history = $$props.history));
      if ("primary" in $$props) $$invalidate(13, (primary = $$props.primary));
      if ("a11y" in $$props) $$invalidate(14, (a11y = $$props.a11y));
      if ("hasActiveRoute" in $$props) hasActiveRoute = $$props.hasActiveRoute;
    };

    if ($$props && "$$inject" in $$props) {
      $$self.$inject_state($$props.$$inject);
    }

    $$self.$$.update = () => {
      if ($$self.$$.dirty[0] & /*basepath*/ 1024) {
        if (basepath !== initialBasepath) {
          warn(
            ROUTER_ID,
            'You cannot change the "basepath" prop. It is ignored.'
          );
        }
      }

      if ($$self.$$.dirty[0] & /*$routes, $location*/ 294912) {
        // This reactive statement will be run when the Router is created
        // when there are no Routes and then again the following tick, so it
        // will not find an active Route in SSR and in the browser it will only
        // pick an active Route after all Routes have been registered.
        {
          const bestMatch = pick($routes, $location.pathname);
          activeRoute.set(bestMatch);
        }
      }

      if ($$self.$$.dirty[0] & /*$location, $prevLocation*/ 163840) {
        // Manage focus and announce navigation to screen reader users
        {
          if (isTopLevelRouter) {
            const hasHash = !!$location.hash;

            // When a hash is present in the url, we skip focus management, because
            // focusing a different element will prevent in-page jumps (See #3)
            const shouldManageFocus = !hasHash && manageFocus;

            // We don't want to make an announcement, when the hash changes,
            // but the active route stays the same
            const announceNavigation =
              !hasHash || $location.pathname !== $prevLocation.pathname;

            triggerFocus(shouldManageFocus, announceNavigation);
          }
        }
      }

      if ($$self.$$.dirty[0] & /*$activeRoute*/ 65536) {
        // Queue matched Route, so top level Router can decide which Route to focus.
        // Non primary Routers should just be ignored
        if (manageFocus && $activeRoute && $activeRoute.primary) {
          pushFocusCandidate({ level, routerId, route: $activeRoute });
        }
      }
    };

    return [
      $announcementText,
      a11yConfig,
      isTopLevelRouter,
      routerId,
      manageFocus,
      announcementText,
      routes,
      activeRoute,
      location,
      prevLocation,
      basepath,
      url,
      history,
      primary,
      a11y,
      $location,
      $activeRoute,
      $prevLocation,
      $routes,
      $$scope,
      slots,
    ];
  }

  class Router extends SvelteComponentDev {
    constructor(options) {
      super(options);

      init(
        this,
        options,
        instance$b,
        create_fragment$b,
        safe_not_equal,
        {
          basepath: 10,
          url: 11,
          history: 12,
          primary: 13,
          a11y: 14,
        },
        null,
        [-1, -1]
      );

      dispatch_dev("SvelteRegisterComponent", {
        component: this,
        tagName: "Router",
        options,
        id: create_fragment$b.name,
      });
    }

    get basepath() {
      throw new Error(
        "<Router>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'"
      );
    }

    set basepath(value) {
      throw new Error(
        "<Router>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'"
      );
    }

    get url() {
      throw new Error(
        "<Router>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'"
      );
    }

    set url(value) {
      throw new Error(
        "<Router>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'"
      );
    }

    get history() {
      throw new Error(
        "<Router>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'"
      );
    }

    set history(value) {
      throw new Error(
        "<Router>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'"
      );
    }

    get primary() {
      throw new Error(
        "<Router>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'"
      );
    }

    set primary(value) {
      throw new Error(
        "<Router>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'"
      );
    }

    get a11y() {
      throw new Error(
        "<Router>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'"
      );
    }

    set a11y(value) {
      throw new Error(
        "<Router>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'"
      );
    }
  }

  var Router$1 = Router;

  /**
   * Check if a component or hook have been created outside of a
   * context providing component
   * @param {number} componentId
   * @param {*} props
   * @param {string?} ctxKey
   * @param {number?} ctxProviderId
   */
  function usePreflightCheck(
    componentId,
    props,
    ctxKey = ROUTER,
    ctxProviderId = ROUTER_ID
  ) {
    const ctx = getContext(ctxKey);
    if (!ctx) {
      fail(
        componentId,
        (label) =>
          `You cannot use ${label} outside of a ${createLabel(ctxProviderId)}.`,
        props
      );
    }
  }

  const toReadonly = (ctx) => {
    const { subscribe } = getContext(ctx);
    return { subscribe };
  };

  /**
     * Access the current location via a readable store.
     * @returns {import("svelte/store").Readable<{
        pathname: string;
        search: string;
        hash: string;
        state: {};
      }>}
     *
     * @example
      ```html
      <script>
        import { useLocation } from "svelte-navigator";

        const location = useLocation();

        $: console.log($location);
        // {
        //   pathname: "/blog",
        //   search: "?id=123",
        //   hash: "#comments",
        //   state: {}
        // }
      </script>
      ```
     */
  function useLocation() {
    usePreflightCheck(USE_LOCATION_ID);
    return toReadonly(LOCATION);
  }

  /**
     * @typedef {{
        path: string;
        fullPath: string;
        uri: string;
        params: {};
      }} RouteMatch
     */

  /**
   * @typedef {import("svelte/store").Readable<RouteMatch|null>} RouteMatchStore
   */

  /**
   * Access the history of top level Router.
   */
  function useHistory() {
    const { history } = getContext(ROUTER);
    return history;
  }

  /**
   * Access the base of the parent Route.
   */
  function useRouteBase() {
    const route = getContext(ROUTE);
    return route ? derived(route, (_route) => _route.base) : writable("/");
  }

  /**
     * Resolve a given link relative to the current `Route` and the `Router`s `basepath`.
     * It is used under the hood in `Link` and `useNavigate`.
     * You can use it to manually resolve links, when using the `link` or `links` actions.
     *
     * @returns {(path: string) => string}
     *
     * @example
      ```html
      <script>
        import { link, useResolve } from "svelte-navigator";

        const resolve = useResolve();
        // `resolvedLink` will be resolved relative to its parent Route
        // and the Routers `basepath`
        const resolvedLink = resolve("relativePath");
      </script>

      <a href={resolvedLink} use:link>Relative link</a>
      ```
     */
  function useResolve() {
    usePreflightCheck(USE_RESOLVE_ID);
    const routeBase = useRouteBase();
    const { basepath: appBase } = getContext(ROUTER);
    /**
     * Resolves the path relative to the current route and basepath.
     *
     * @param {string} path The path to resolve
     * @returns {string} The resolved path
     */
    const resolve = (path) =>
      resolveLink(path, get_store_value(routeBase), appBase);
    return resolve;
  }

  /**
     * A hook, that returns a context-aware version of `navigate`.
     * It will automatically resolve the given link relative to the current Route.
     * It will also resolve a link against the `basepath` of the Router.
     *
     * @example
      ```html
      <!-- App.svelte -->
      <script>
        import { link, Route } from "svelte-navigator";
        import RouteComponent from "./RouteComponent.svelte";
      </script>

      <Router>
        <Route path="route1">
          <RouteComponent />
        </Route>
        <!-- ... -->
      </Router>

      <!-- RouteComponent.svelte -->
      <script>
        import { useNavigate } from "svelte-navigator";

        const navigate = useNavigate();
      </script>

      <button on:click="{() => navigate('relativePath')}">
        go to /route1/relativePath
      </button>
      <button on:click="{() => navigate('/absolutePath')}">
        go to /absolutePath
      </button>
      ```
      *
      * @example
      ```html
      <!-- App.svelte -->
      <script>
        import { link, Route } from "svelte-navigator";
        import RouteComponent from "./RouteComponent.svelte";
      </script>

      <Router basepath="/base">
        <Route path="route1">
          <RouteComponent />
        </Route>
        <!-- ... -->
      </Router>

      <!-- RouteComponent.svelte -->
      <script>
        import { useNavigate } from "svelte-navigator";

        const navigate = useNavigate();
      </script>

      <button on:click="{() => navigate('relativePath')}">
        go to /base/route1/relativePath
      </button>
      <button on:click="{() => navigate('/absolutePath')}">
        go to /base/absolutePath
      </button>
      ```
     */
  function useNavigate() {
    usePreflightCheck(USE_NAVIGATE_ID);
    const resolve = useResolve();
    const { navigate } = useHistory();
    /**
     * Navigate to a new route.
     * Resolves the link relative to the current route and basepath.
     *
     * @param {string|number} to The path to navigate to.
     *
     * If `to` is a number we will navigate to the stack entry index + `to`
     * (-> `navigate(-1)`, is equivalent to hitting the back button of the browser)
     * @param {Object} options
     * @param {*} [options.state]
     * @param {boolean} [options.replace=false]
     */
    const navigateRelative = (to, options) => {
      // If to is a number, we navigate to the target stack entry via `history.go`.
      // Otherwise resolve the link
      const target = isNumber(to) ? to : resolve(to);
      return navigate(target, options);
    };
    return navigateRelative;
  }

  /* node_modules/svelte-navigator/src/Route.svelte generated by Svelte v3.42.1 */
  const file$a = "node_modules/svelte-navigator/src/Route.svelte";

  const get_default_slot_changes = (dirty) => ({
    params: dirty & /*$params*/ 16,
    location: dirty & /*$location*/ 8,
  });

  const get_default_slot_context = (ctx) => ({
    params: isSSR ? get_store_value(/*params*/ ctx[9]) : /*$params*/ ctx[4],
    location: /*$location*/ ctx[3],
    navigate: /*navigate*/ ctx[10],
  });

  // (97:0) {#if isActive}
  function create_if_block$3(ctx) {
    let router;
    let current;

    router = new Router$1({
      props: {
        primary: /*primary*/ ctx[1],
        $$slots: { default: [create_default_slot$4] },
        $$scope: { ctx },
      },
      $$inline: true,
    });

    const block = {
      c: function create() {
        create_component(router.$$.fragment);
      },
      m: function mount(target, anchor) {
        mount_component(router, target, anchor);
        current = true;
      },
      p: function update(ctx, dirty) {
        const router_changes = {};
        if (dirty & /*primary*/ 2) router_changes.primary = /*primary*/ ctx[1];

        if (
          dirty & /*$$scope, component, $location, $params, $$restProps*/ 264217
        ) {
          router_changes.$$scope = { dirty, ctx };
        }

        router.$set(router_changes);
      },
      i: function intro(local) {
        if (current) return;
        transition_in(router.$$.fragment, local);
        current = true;
      },
      o: function outro(local) {
        transition_out(router.$$.fragment, local);
        current = false;
      },
      d: function destroy(detaching) {
        destroy_component(router, detaching);
      },
    };

    dispatch_dev("SvelteRegisterBlock", {
      block,
      id: create_if_block$3.name,
      type: "if",
      source: "(97:0) {#if isActive}",
      ctx,
    });

    return block;
  }

  // (113:2) {:else}
  function create_else_block$1(ctx) {
    let current;
    const default_slot_template = /*#slots*/ ctx[17].default;
    const default_slot = create_slot(
      default_slot_template,
      ctx,
      /*$$scope*/ ctx[18],
      get_default_slot_context
    );

    const block = {
      c: function create() {
        if (default_slot) default_slot.c();
      },
      m: function mount(target, anchor) {
        if (default_slot) {
          default_slot.m(target, anchor);
        }

        current = true;
      },
      p: function update(ctx, dirty) {
        if (default_slot) {
          if (
            default_slot.p &&
            (!current || dirty & /*$$scope, $params, $location*/ 262168)
          ) {
            update_slot_base(
              default_slot,
              default_slot_template,
              ctx,
              /*$$scope*/ ctx[18],
              !current
                ? get_all_dirty_from_scope(/*$$scope*/ ctx[18])
                : get_slot_changes(
                    default_slot_template,
                    /*$$scope*/ ctx[18],
                    dirty,
                    get_default_slot_changes
                  ),
              get_default_slot_context
            );
          }
        }
      },
      i: function intro(local) {
        if (current) return;
        transition_in(default_slot, local);
        current = true;
      },
      o: function outro(local) {
        transition_out(default_slot, local);
        current = false;
      },
      d: function destroy(detaching) {
        if (default_slot) default_slot.d(detaching);
      },
    };

    dispatch_dev("SvelteRegisterBlock", {
      block,
      id: create_else_block$1.name,
      type: "else",
      source: "(113:2) {:else}",
      ctx,
    });

    return block;
  }

  // (105:2) {#if component !== null}
  function create_if_block_1$2(ctx) {
    let switch_instance;
    let switch_instance_anchor;
    let current;

    const switch_instance_spread_levels = [
      { location: /*$location*/ ctx[3] },
      { navigate: /*navigate*/ ctx[10] },
      isSSR ? get_store_value(/*params*/ ctx[9]) : /*$params*/ ctx[4],
      /*$$restProps*/ ctx[11],
    ];

    var switch_value = /*component*/ ctx[0];

    function switch_props(ctx) {
      let switch_instance_props = {};

      for (let i = 0; i < switch_instance_spread_levels.length; i += 1) {
        switch_instance_props = assign(
          switch_instance_props,
          switch_instance_spread_levels[i]
        );
      }

      return {
        props: switch_instance_props,
        $$inline: true,
      };
    }

    if (switch_value) {
      switch_instance = new switch_value(switch_props());
    }

    const block = {
      c: function create() {
        if (switch_instance) create_component(switch_instance.$$.fragment);
        switch_instance_anchor = empty();
      },
      m: function mount(target, anchor) {
        if (switch_instance) {
          mount_component(switch_instance, target, anchor);
        }

        insert_dev(target, switch_instance_anchor, anchor);
        current = true;
      },
      p: function update(ctx, dirty) {
        const switch_instance_changes =
          dirty &
          /*$location, navigate, isSSR, get, params, $params, $$restProps*/ 3608
            ? get_spread_update(switch_instance_spread_levels, [
                dirty & /*$location*/ 8 && { location: /*$location*/ ctx[3] },
                dirty & /*navigate*/ 1024 && { navigate: /*navigate*/ ctx[10] },
                dirty & /*isSSR, get, params, $params*/ 528 &&
                  get_spread_object(
                    isSSR
                      ? get_store_value(/*params*/ ctx[9])
                      : /*$params*/ ctx[4]
                  ),
                dirty & /*$$restProps*/ 2048 &&
                  get_spread_object(/*$$restProps*/ ctx[11]),
              ])
            : {};

        if (switch_value !== (switch_value = /*component*/ ctx[0])) {
          if (switch_instance) {
            group_outros();
            const old_component = switch_instance;

            transition_out(old_component.$$.fragment, 1, 0, () => {
              destroy_component(old_component, 1);
            });

            check_outros();
          }

          if (switch_value) {
            switch_instance = new switch_value(switch_props());
            create_component(switch_instance.$$.fragment);
            transition_in(switch_instance.$$.fragment, 1);
            mount_component(
              switch_instance,
              switch_instance_anchor.parentNode,
              switch_instance_anchor
            );
          } else {
            switch_instance = null;
          }
        } else if (switch_value) {
          switch_instance.$set(switch_instance_changes);
        }
      },
      i: function intro(local) {
        if (current) return;
        if (switch_instance) transition_in(switch_instance.$$.fragment, local);
        current = true;
      },
      o: function outro(local) {
        if (switch_instance) transition_out(switch_instance.$$.fragment, local);
        current = false;
      },
      d: function destroy(detaching) {
        if (detaching) detach_dev(switch_instance_anchor);
        if (switch_instance) destroy_component(switch_instance, detaching);
      },
    };

    dispatch_dev("SvelteRegisterBlock", {
      block,
      id: create_if_block_1$2.name,
      type: "if",
      source: "(105:2) {#if component !== null}",
      ctx,
    });

    return block;
  }

  // (98:1) <Router {primary}>
  function create_default_slot$4(ctx) {
    let current_block_type_index;
    let if_block;
    let if_block_anchor;
    let current;
    const if_block_creators = [create_if_block_1$2, create_else_block$1];
    const if_blocks = [];

    function select_block_type(ctx, dirty) {
      if (/*component*/ ctx[0] !== null) return 0;
      return 1;
    }

    current_block_type_index = select_block_type(ctx);
    if_block = if_blocks[current_block_type_index] = if_block_creators[
      current_block_type_index
    ](ctx);

    const block = {
      c: function create() {
        if_block.c();
        if_block_anchor = empty();
      },
      m: function mount(target, anchor) {
        if_blocks[current_block_type_index].m(target, anchor);
        insert_dev(target, if_block_anchor, anchor);
        current = true;
      },
      p: function update(ctx, dirty) {
        let previous_block_index = current_block_type_index;
        current_block_type_index = select_block_type(ctx);

        if (current_block_type_index === previous_block_index) {
          if_blocks[current_block_type_index].p(ctx, dirty);
        } else {
          group_outros();

          transition_out(if_blocks[previous_block_index], 1, 1, () => {
            if_blocks[previous_block_index] = null;
          });

          check_outros();
          if_block = if_blocks[current_block_type_index];

          if (!if_block) {
            if_block = if_blocks[current_block_type_index] = if_block_creators[
              current_block_type_index
            ](ctx);
            if_block.c();
          } else {
            if_block.p(ctx, dirty);
          }

          transition_in(if_block, 1);
          if_block.m(if_block_anchor.parentNode, if_block_anchor);
        }
      },
      i: function intro(local) {
        if (current) return;
        transition_in(if_block);
        current = true;
      },
      o: function outro(local) {
        transition_out(if_block);
        current = false;
      },
      d: function destroy(detaching) {
        if_blocks[current_block_type_index].d(detaching);
        if (detaching) detach_dev(if_block_anchor);
      },
    };

    dispatch_dev("SvelteRegisterBlock", {
      block,
      id: create_default_slot$4.name,
      type: "slot",
      source: "(98:1) <Router {primary}>",
      ctx,
    });

    return block;
  }

  function create_fragment$a(ctx) {
    let div0;
    let t0;
    let t1;
    let div1;
    let current;
    let if_block = /*isActive*/ ctx[2] && create_if_block$3(ctx);

    const block = {
      c: function create() {
        div0 = element("div");
        t0 = space();
        if (if_block) if_block.c();
        t1 = space();
        div1 = element("div");
        set_style(div0, "display", "none");
        attr_dev(div0, "aria-hidden", "true");
        attr_dev(div0, "data-svnav-route-start", /*id*/ ctx[5]);
        add_location(div0, file$a, 95, 0, 2622);
        set_style(div1, "display", "none");
        attr_dev(div1, "aria-hidden", "true");
        attr_dev(div1, "data-svnav-route-end", /*id*/ ctx[5]);
        add_location(div1, file$a, 121, 0, 3295);
      },
      l: function claim(nodes) {
        throw new Error(
          "options.hydrate only works if the component was compiled with the `hydratable: true` option"
        );
      },
      m: function mount(target, anchor) {
        insert_dev(target, div0, anchor);
        insert_dev(target, t0, anchor);
        if (if_block) if_block.m(target, anchor);
        insert_dev(target, t1, anchor);
        insert_dev(target, div1, anchor);
        current = true;
      },
      p: function update(ctx, [dirty]) {
        if (/*isActive*/ ctx[2]) {
          if (if_block) {
            if_block.p(ctx, dirty);

            if (dirty & /*isActive*/ 4) {
              transition_in(if_block, 1);
            }
          } else {
            if_block = create_if_block$3(ctx);
            if_block.c();
            transition_in(if_block, 1);
            if_block.m(t1.parentNode, t1);
          }
        } else if (if_block) {
          group_outros();

          transition_out(if_block, 1, 1, () => {
            if_block = null;
          });

          check_outros();
        }
      },
      i: function intro(local) {
        if (current) return;
        transition_in(if_block);
        current = true;
      },
      o: function outro(local) {
        transition_out(if_block);
        current = false;
      },
      d: function destroy(detaching) {
        if (detaching) detach_dev(div0);
        if (detaching) detach_dev(t0);
        if (if_block) if_block.d(detaching);
        if (detaching) detach_dev(t1);
        if (detaching) detach_dev(div1);
      },
    };

    dispatch_dev("SvelteRegisterBlock", {
      block,
      id: create_fragment$a.name,
      type: "component",
      source: "",
      ctx,
    });

    return block;
  }

  const createId = createCounter();

  function instance$a($$self, $$props, $$invalidate) {
    let isActive;
    const omit_props_names = ["path", "component", "meta", "primary"];
    let $$restProps = compute_rest_props($$props, omit_props_names);
    let $activeRoute;
    let $location;
    let $parentBase;
    let $params;
    let { $$slots: slots = {}, $$scope } = $$props;
    validate_slots("Route", slots, ["default"]);
    let { path = "" } = $$props;
    let { component = null } = $$props;
    let { meta = {} } = $$props;
    let { primary = true } = $$props;
    usePreflightCheck(ROUTE_ID, $$props);
    const id = createId();
    const { registerRoute, unregisterRoute, activeRoute } = getContext(ROUTER);
    validate_store(activeRoute, "activeRoute");
    component_subscribe($$self, activeRoute, (value) =>
      $$invalidate(15, ($activeRoute = value))
    );
    const parentBase = useRouteBase();
    validate_store(parentBase, "parentBase");
    component_subscribe($$self, parentBase, (value) =>
      $$invalidate(16, ($parentBase = value))
    );
    const location = useLocation();
    validate_store(location, "location");
    component_subscribe($$self, location, (value) =>
      $$invalidate(3, ($location = value))
    );
    const focusElement = writable(null);

    // In SSR we cannot wait for $activeRoute to update,
    // so we use the match returned from `registerRoute` instead
    let ssrMatch;

    const route = writable();
    const params = writable({});
    validate_store(params, "params");
    component_subscribe($$self, params, (value) =>
      $$invalidate(4, ($params = value))
    );
    setContext(ROUTE, route);
    setContext(ROUTE_PARAMS, params);
    setContext(FOCUS_ELEM, focusElement);

    // We need to call useNavigate after the route is set,
    // so we can use the routes path for link resolution
    const navigate = useNavigate();

    // There is no need to unregister Routes in SSR since it will all be
    // thrown away anyway
    if (!isSSR) {
      onDestroy(() => unregisterRoute(id));
    }

    $$self.$$set = ($$new_props) => {
      $$invalidate(
        23,
        ($$props = assign(
          assign({}, $$props),
          exclude_internal_props($$new_props)
        ))
      );
      $$invalidate(
        11,
        ($$restProps = compute_rest_props($$props, omit_props_names))
      );
      if ("path" in $$new_props) $$invalidate(12, (path = $$new_props.path));
      if ("component" in $$new_props)
        $$invalidate(0, (component = $$new_props.component));
      if ("meta" in $$new_props) $$invalidate(13, (meta = $$new_props.meta));
      if ("primary" in $$new_props)
        $$invalidate(1, (primary = $$new_props.primary));
      if ("$$scope" in $$new_props)
        $$invalidate(18, ($$scope = $$new_props.$$scope));
    };

    $$self.$capture_state = () => ({
      createCounter,
      createId,
      getContext,
      onDestroy,
      setContext,
      writable,
      get: get_store_value,
      Router: Router$1,
      ROUTER,
      ROUTE,
      ROUTE_PARAMS,
      FOCUS_ELEM,
      useLocation,
      useNavigate,
      useRouteBase,
      usePreflightCheck,
      isSSR,
      extractBaseUri,
      join,
      ROUTE_ID,
      path,
      component,
      meta,
      primary,
      id,
      registerRoute,
      unregisterRoute,
      activeRoute,
      parentBase,
      location,
      focusElement,
      ssrMatch,
      route,
      params,
      navigate,
      isActive,
      $activeRoute,
      $location,
      $parentBase,
      $params,
    });

    $$self.$inject_state = ($$new_props) => {
      $$invalidate(23, ($$props = assign(assign({}, $$props), $$new_props)));
      if ("path" in $$props) $$invalidate(12, (path = $$new_props.path));
      if ("component" in $$props)
        $$invalidate(0, (component = $$new_props.component));
      if ("meta" in $$props) $$invalidate(13, (meta = $$new_props.meta));
      if ("primary" in $$props)
        $$invalidate(1, (primary = $$new_props.primary));
      if ("ssrMatch" in $$props)
        $$invalidate(14, (ssrMatch = $$new_props.ssrMatch));
      if ("isActive" in $$props)
        $$invalidate(2, (isActive = $$new_props.isActive));
    };

    if ($$props && "$$inject" in $$props) {
      $$self.$inject_state($$props.$$inject);
    }

    $$self.$$.update = () => {
      if (
        $$self.$$.dirty & /*path, $parentBase, meta, $location, primary*/ 77834
      ) {
        {
          // The route store will be re-computed whenever props, location or parentBase change
          const isDefault = path === "";

          const rawBase = join($parentBase, path);

          const updatedRoute = {
            id,
            path,
            meta,
            // If no path prop is given, this Route will act as the default Route
            // that is rendered if no other Route in the Router is a match
            default: isDefault,
            fullPath: isDefault ? "" : rawBase,
            base: isDefault
              ? $parentBase
              : extractBaseUri(rawBase, $location.pathname),
            primary,
            focusElement,
          };

          route.set(updatedRoute);

          // If we're in SSR mode and the Route matches,
          // `registerRoute` will return the match
          $$invalidate(14, (ssrMatch = registerRoute(updatedRoute)));
        }
      }

      if ($$self.$$.dirty & /*ssrMatch, $activeRoute*/ 49152) {
        $$invalidate(
          2,
          (isActive = !!(ssrMatch || ($activeRoute && $activeRoute.id === id)))
        );
      }

      if ($$self.$$.dirty & /*isActive, ssrMatch, $activeRoute*/ 49156) {
        if (isActive) {
          const { params: activeParams } = ssrMatch || $activeRoute;
          params.set(activeParams);
        }
      }
    };

    $$props = exclude_internal_props($$props);

    return [
      component,
      primary,
      isActive,
      $location,
      $params,
      id,
      activeRoute,
      parentBase,
      location,
      params,
      navigate,
      $$restProps,
      path,
      meta,
      ssrMatch,
      $activeRoute,
      $parentBase,
      slots,
      $$scope,
    ];
  }

  class Route extends SvelteComponentDev {
    constructor(options) {
      super(options);

      init(this, options, instance$a, create_fragment$a, safe_not_equal, {
        path: 12,
        component: 0,
        meta: 13,
        primary: 1,
      });

      dispatch_dev("SvelteRegisterComponent", {
        component: this,
        tagName: "Route",
        options,
        id: create_fragment$a.name,
      });
    }

    get path() {
      throw new Error(
        "<Route>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'"
      );
    }

    set path(value) {
      throw new Error(
        "<Route>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'"
      );
    }

    get component() {
      throw new Error(
        "<Route>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'"
      );
    }

    set component(value) {
      throw new Error(
        "<Route>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'"
      );
    }

    get meta() {
      throw new Error(
        "<Route>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'"
      );
    }

    set meta(value) {
      throw new Error(
        "<Route>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'"
      );
    }

    get primary() {
      throw new Error(
        "<Route>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'"
      );
    }

    set primary(value) {
      throw new Error(
        "<Route>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'"
      );
    }
  }

  var Route$1 = Route;

  /* node_modules/svelte-navigator/src/Link.svelte generated by Svelte v3.42.1 */
  const file$9 = "node_modules/svelte-navigator/src/Link.svelte";

  function create_fragment$9(ctx) {
    let a;
    let current;
    let mounted;
    let dispose;
    const default_slot_template = /*#slots*/ ctx[13].default;
    const default_slot = create_slot(
      default_slot_template,
      ctx,
      /*$$scope*/ ctx[12],
      null
    );
    let a_levels = [
      { href: /*href*/ ctx[0] },
      /*ariaCurrent*/ ctx[2],
      /*props*/ ctx[1],
    ];
    let a_data = {};

    for (let i = 0; i < a_levels.length; i += 1) {
      a_data = assign(a_data, a_levels[i]);
    }

    const block = {
      c: function create() {
        a = element("a");
        if (default_slot) default_slot.c();
        set_attributes(a, a_data);
        add_location(a, file$9, 63, 0, 1735);
      },
      l: function claim(nodes) {
        throw new Error(
          "options.hydrate only works if the component was compiled with the `hydratable: true` option"
        );
      },
      m: function mount(target, anchor) {
        insert_dev(target, a, anchor);

        if (default_slot) {
          default_slot.m(a, null);
        }

        current = true;

        if (!mounted) {
          dispose = listen_dev(
            a,
            "click",
            /*onClick*/ ctx[4],
            false,
            false,
            false
          );
          mounted = true;
        }
      },
      p: function update(ctx, [dirty]) {
        if (default_slot) {
          if (default_slot.p && (!current || dirty & /*$$scope*/ 4096)) {
            update_slot_base(
              default_slot,
              default_slot_template,
              ctx,
              /*$$scope*/ ctx[12],
              !current
                ? get_all_dirty_from_scope(/*$$scope*/ ctx[12])
                : get_slot_changes(
                    default_slot_template,
                    /*$$scope*/ ctx[12],
                    dirty,
                    null
                  ),
              null
            );
          }
        }

        set_attributes(
          a,
          (a_data = get_spread_update(a_levels, [
            (!current || dirty & /*href*/ 1) && { href: /*href*/ ctx[0] },
            dirty & /*ariaCurrent*/ 4 && /*ariaCurrent*/ ctx[2],
            dirty & /*props*/ 2 && /*props*/ ctx[1],
          ]))
        );
      },
      i: function intro(local) {
        if (current) return;
        transition_in(default_slot, local);
        current = true;
      },
      o: function outro(local) {
        transition_out(default_slot, local);
        current = false;
      },
      d: function destroy(detaching) {
        if (detaching) detach_dev(a);
        if (default_slot) default_slot.d(detaching);
        mounted = false;
        dispose();
      },
    };

    dispatch_dev("SvelteRegisterBlock", {
      block,
      id: create_fragment$9.name,
      type: "component",
      source: "",
      ctx,
    });

    return block;
  }

  function instance$9($$self, $$props, $$invalidate) {
    let href;
    let isPartiallyCurrent;
    let isCurrent;
    let ariaCurrent;
    let props;
    const omit_props_names = ["to", "replace", "state", "getProps"];
    let $$restProps = compute_rest_props($$props, omit_props_names);
    let $location;
    let { $$slots: slots = {}, $$scope } = $$props;
    validate_slots("Link", slots, ["default"]);
    let { to } = $$props;
    let { replace = false } = $$props;
    let { state = {} } = $$props;
    let { getProps = null } = $$props;
    usePreflightCheck(LINK_ID, $$props);
    const location = useLocation();
    validate_store(location, "location");
    component_subscribe($$self, location, (value) =>
      $$invalidate(11, ($location = value))
    );
    const dispatch = createEventDispatcher();
    const resolve = useResolve();
    const { navigate } = useHistory();

    function onClick(event) {
      dispatch("click", event);

      if (shouldNavigate(event)) {
        event.preventDefault();

        // Don't push another entry to the history stack when the user
        // clicks on a Link to the page they are currently on.
        const shouldReplace = isCurrent || replace;

        navigate(href, { state, replace: shouldReplace });
      }
    }

    $$self.$$set = ($$new_props) => {
      $$invalidate(
        18,
        ($$props = assign(
          assign({}, $$props),
          exclude_internal_props($$new_props)
        ))
      );
      $$invalidate(
        17,
        ($$restProps = compute_rest_props($$props, omit_props_names))
      );
      if ("to" in $$new_props) $$invalidate(5, (to = $$new_props.to));
      if ("replace" in $$new_props)
        $$invalidate(6, (replace = $$new_props.replace));
      if ("state" in $$new_props) $$invalidate(7, (state = $$new_props.state));
      if ("getProps" in $$new_props)
        $$invalidate(8, (getProps = $$new_props.getProps));
      if ("$$scope" in $$new_props)
        $$invalidate(12, ($$scope = $$new_props.$$scope));
    };

    $$self.$capture_state = () => ({
      createEventDispatcher,
      useLocation,
      useResolve,
      useHistory,
      usePreflightCheck,
      shouldNavigate,
      isFunction,
      startsWith,
      LINK_ID,
      to,
      replace,
      state,
      getProps,
      location,
      dispatch,
      resolve,
      navigate,
      onClick,
      href,
      isCurrent,
      isPartiallyCurrent,
      props,
      ariaCurrent,
      $location,
    });

    $$self.$inject_state = ($$new_props) => {
      $$invalidate(18, ($$props = assign(assign({}, $$props), $$new_props)));
      if ("to" in $$props) $$invalidate(5, (to = $$new_props.to));
      if ("replace" in $$props)
        $$invalidate(6, (replace = $$new_props.replace));
      if ("state" in $$props) $$invalidate(7, (state = $$new_props.state));
      if ("getProps" in $$props)
        $$invalidate(8, (getProps = $$new_props.getProps));
      if ("href" in $$props) $$invalidate(0, (href = $$new_props.href));
      if ("isCurrent" in $$props)
        $$invalidate(9, (isCurrent = $$new_props.isCurrent));
      if ("isPartiallyCurrent" in $$props)
        $$invalidate(10, (isPartiallyCurrent = $$new_props.isPartiallyCurrent));
      if ("props" in $$props) $$invalidate(1, (props = $$new_props.props));
      if ("ariaCurrent" in $$props)
        $$invalidate(2, (ariaCurrent = $$new_props.ariaCurrent));
    };

    if ($$props && "$$inject" in $$props) {
      $$self.$inject_state($$props.$$inject);
    }

    $$self.$$.update = () => {
      if ($$self.$$.dirty & /*to, $location*/ 2080) {
        // We need to pass location here to force re-resolution of the link,
        // when the pathname changes. Otherwise we could end up with stale path params,
        // when for example an :id changes in the parent Routes path
        $$invalidate(0, (href = resolve(to, $location)));
      }

      if ($$self.$$.dirty & /*$location, href*/ 2049) {
        $$invalidate(
          10,
          (isPartiallyCurrent = startsWith($location.pathname, href))
        );
      }

      if ($$self.$$.dirty & /*href, $location*/ 2049) {
        $$invalidate(9, (isCurrent = href === $location.pathname));
      }

      if ($$self.$$.dirty & /*isCurrent*/ 512) {
        $$invalidate(
          2,
          (ariaCurrent = isCurrent ? { "aria-current": "page" } : {})
        );
      }

      $$invalidate(
        1,
        (props = (() => {
          if (isFunction(getProps)) {
            const dynamicProps = getProps({
              location: $location,
              href,
              isPartiallyCurrent,
              isCurrent,
            });

            return { ...$$restProps, ...dynamicProps };
          }

          return $$restProps;
        })())
      );
    };

    $$props = exclude_internal_props($$props);

    return [
      href,
      props,
      ariaCurrent,
      location,
      onClick,
      to,
      replace,
      state,
      getProps,
      isCurrent,
      isPartiallyCurrent,
      $location,
      $$scope,
      slots,
    ];
  }

  class Link extends SvelteComponentDev {
    constructor(options) {
      super(options);
      init(this, options, instance$9, create_fragment$9, safe_not_equal, {
        to: 5,
        replace: 6,
        state: 7,
        getProps: 8,
      });

      dispatch_dev("SvelteRegisterComponent", {
        component: this,
        tagName: "Link",
        options,
        id: create_fragment$9.name,
      });

      const { ctx } = this.$$;
      const props = options.props || {};

      if (/*to*/ ctx[5] === undefined && !("to" in props)) {
        console.warn("<Link> was created without expected prop 'to'");
      }
    }

    get to() {
      throw new Error(
        "<Link>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'"
      );
    }

    set to(value) {
      throw new Error(
        "<Link>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'"
      );
    }

    get replace() {
      throw new Error(
        "<Link>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'"
      );
    }

    set replace(value) {
      throw new Error(
        "<Link>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'"
      );
    }

    get state() {
      throw new Error(
        "<Link>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'"
      );
    }

    set state(value) {
      throw new Error(
        "<Link>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'"
      );
    }

    get getProps() {
      throw new Error(
        "<Link>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'"
      );
    }

    set getProps(value) {
      throw new Error(
        "<Link>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'"
      );
    }
  }

  var Link$1 = Link;

  const paths = {
    HOME: "/",
    SIGN_IN: "/login",
    REGISTER: "/register",
    ONBOARDING: "/onboarding",
    PASSWORD_RECOVERY: "/password_recovery",
  };

  /* src/views/Home.svelte generated by Svelte v3.42.1 */

  const file$8 = "src/views/Home.svelte";

  function create_fragment$8(ctx) {
    let h1;

    const block = {
      c: function create() {
        h1 = element("h1");
        h1.textContent = "Cool home bro";
        add_location(h1, file$8, 2, 0, 29);
      },
      l: function claim(nodes) {
        throw new Error(
          "options.hydrate only works if the component was compiled with the `hydratable: true` option"
        );
      },
      m: function mount(target, anchor) {
        insert_dev(target, h1, anchor);
      },
      p: noop,
      i: noop,
      o: noop,
      d: function destroy(detaching) {
        if (detaching) detach_dev(h1);
      },
    };

    dispatch_dev("SvelteRegisterBlock", {
      block,
      id: create_fragment$8.name,
      type: "component",
      source: "",
      ctx,
    });

    return block;
  }

  function instance$8($$self, $$props) {
    let { $$slots: slots = {}, $$scope } = $$props;
    validate_slots("Home", slots, []);
    const writable_props = [];

    Object.keys($$props).forEach((key) => {
      if (
        !~writable_props.indexOf(key) &&
        key.slice(0, 2) !== "$$" &&
        key !== "slot"
      )
        console.warn(`<Home> was created with unknown prop '${key}'`);
    });

    return [];
  }

  class Home extends SvelteComponentDev {
    constructor(options) {
      super(options);
      init(this, options, instance$8, create_fragment$8, safe_not_equal, {});

      dispatch_dev("SvelteRegisterComponent", {
        component: this,
        tagName: "Home",
        options,
        id: create_fragment$8.name,
      });
    }
  }

  var user = writable(null);

  var InputType;
  (function (InputType) {
    InputType["text"] = "text";
    InputType["number"] = "number";
    InputType["url"] = "url";
    InputType["password"] = "password";
  })(InputType || (InputType = {}));
  var ButtonType;
  (function (ButtonType) {
    ButtonType["submit"] = "submit";
    ButtonType["button"] = "button";
  })(ButtonType || (ButtonType = {}));
  var IconName;
  (function (IconName) {
    IconName["trash"] = "trash";
    IconName["edit"] = "edit";
    IconName["send"] = "paper-plane";
    IconName["mail_bulk"] = "mail-bulk";
    IconName["close"] = "times";
    IconName["newspaper"] = "newspaper";
    IconName["thumbs_up"] = "thumbs-up";
    IconName["skull_crossbones"] = "skull-crossbones";
  })(IconName || (IconName = {}));
  var Size;
  (function (Size) {
    Size["sm"] = "small";
    Size["md"] = "medium";
  })(Size || (Size = {}));
  var Gap;
  (function (Gap) {
    Gap["xs"] = "--gap-xs";
    Gap["sm"] = "--gap-sm";
    Gap["md"] = "--gap-md";
    Gap["lg"] = "--gap-lg";
    Gap["xl"] = "--gap-xl";
  })(Gap || (Gap = {}));
  var Color;
  (function (Color) {
    Color["gray"] = "--gray";
    Color["secondary"] = "--secondary";
    Color["primary"] = "--primary";
    Color["error"] = "--error";
    Color["white"] = "--white";
    Color["transparent"] = "--transparent";
  })(Color || (Color = {}));
  var APIStatus;
  (function (APIStatus) {
    APIStatus["ok"] = "ok";
    APIStatus["error"] = "error";
  })(APIStatus || (APIStatus = {}));
  const getErrorFor = (key, errors) => {
    if (!errors) return;
    const error = errors.find((e) => e.loc.includes(key));
    if (!error) return null;
    return error.msg;
  };

  var api = derived(user, ($user) => {
    const method = async (path, options = { headers: {} }) => {
      let token = localStorage.getItem("token");
      if (!token) {
        token = new URLSearchParams(window.location.search).get("token");
        if (token) localStorage.setItem("token", token);
      }
      const opts = Object.assign({}, options);
      if (token)
        opts.headers = Object.assign(
          { Authorization: `Bearer ${token}` },
          options.headers
        );
      if (opts.body)
        opts.headers = Object.assign(
          { "Content-Type": "application/json" },
          opts.headers
        );
      const response = await fetch(path, opts);
      const result = {
        status: APIStatus.ok,
        body: (await response.json()) || {},
      };
      if (response.status === 401) {
        user.update(() => {
          localStorage.removeItem("token");
          return null;
        });
        window.location.replace(paths.SIGN_IN);
      }
      if (response.status < 200 || response.status >= 300)
        result.status = APIStatus.error;
      if ("details" in result.body) result.body = result.body.details;
      return result;
    };
    return method;
  });

  /* src/layouts/AuthLayout.svelte generated by Svelte v3.42.1 */

  const file$7 = "src/layouts/AuthLayout.svelte";

  function create_fragment$7(ctx) {
    let div1;
    let div0;
    let current;
    const default_slot_template = /*#slots*/ ctx[1].default;
    const default_slot = create_slot(
      default_slot_template,
      ctx,
      /*$$scope*/ ctx[0],
      null
    );

    const block = {
      c: function create() {
        div1 = element("div");
        div0 = element("div");
        if (default_slot) default_slot.c();
        attr_dev(div0, "class", "card svelte-1c7iqu1");
        add_location(div0, file$7, 19, 2, 308);
        attr_dev(div1, "class", "wrapper svelte-1c7iqu1");
        add_location(div1, file$7, 18, 0, 284);
      },
      l: function claim(nodes) {
        throw new Error(
          "options.hydrate only works if the component was compiled with the `hydratable: true` option"
        );
      },
      m: function mount(target, anchor) {
        insert_dev(target, div1, anchor);
        append_dev(div1, div0);

        if (default_slot) {
          default_slot.m(div0, null);
        }

        current = true;
      },
      p: function update(ctx, [dirty]) {
        if (default_slot) {
          if (default_slot.p && (!current || dirty & /*$$scope*/ 1)) {
            update_slot_base(
              default_slot,
              default_slot_template,
              ctx,
              /*$$scope*/ ctx[0],
              !current
                ? get_all_dirty_from_scope(/*$$scope*/ ctx[0])
                : get_slot_changes(
                    default_slot_template,
                    /*$$scope*/ ctx[0],
                    dirty,
                    null
                  ),
              null
            );
          }
        }
      },
      i: function intro(local) {
        if (current) return;
        transition_in(default_slot, local);
        current = true;
      },
      o: function outro(local) {
        transition_out(default_slot, local);
        current = false;
      },
      d: function destroy(detaching) {
        if (detaching) detach_dev(div1);
        if (default_slot) default_slot.d(detaching);
      },
    };

    dispatch_dev("SvelteRegisterBlock", {
      block,
      id: create_fragment$7.name,
      type: "component",
      source: "",
      ctx,
    });

    return block;
  }

  function instance$7($$self, $$props, $$invalidate) {
    let { $$slots: slots = {}, $$scope } = $$props;
    validate_slots("AuthLayout", slots, ["default"]);
    const writable_props = [];

    Object.keys($$props).forEach((key) => {
      if (
        !~writable_props.indexOf(key) &&
        key.slice(0, 2) !== "$$" &&
        key !== "slot"
      )
        console.warn(`<AuthLayout> was created with unknown prop '${key}'`);
    });

    $$self.$$set = ($$props) => {
      if ("$$scope" in $$props) $$invalidate(0, ($$scope = $$props.$$scope));
    };

    return [$$scope, slots];
  }

  class AuthLayout extends SvelteComponentDev {
    constructor(options) {
      super(options);
      init(this, options, instance$7, create_fragment$7, safe_not_equal, {});

      dispatch_dev("SvelteRegisterComponent", {
        component: this,
        tagName: "AuthLayout",
        options,
        id: create_fragment$7.name,
      });
    }
  }

  /* src/components/Input.svelte generated by Svelte v3.42.1 */
  const file$6 = "src/components/Input.svelte";

  // (84:4) {#if label}
  function create_if_block_2(ctx) {
    let label_1;
    let t;
    let if_block = /*required*/ ctx[5] && create_if_block_3(ctx);

    const block = {
      c: function create() {
        label_1 = element("label");
        t = text(/*label*/ ctx[4]);
        if (if_block) if_block.c();
        attr_dev(label_1, "for", /*name*/ ctx[1]);
        attr_dev(label_1, "class", "svelte-cgr9nh");
        add_location(label_1, file$6, 84, 6, 1735);
      },
      m: function mount(target, anchor) {
        insert_dev(target, label_1, anchor);
        append_dev(label_1, t);
        if (if_block) if_block.m(label_1, null);
      },
      p: function update(ctx, dirty) {
        if (dirty & /*label*/ 16) set_data_dev(t, /*label*/ ctx[4]);

        if (/*required*/ ctx[5]) {
          if (if_block);
          else {
            if_block = create_if_block_3(ctx);
            if_block.c();
            if_block.m(label_1, null);
          }
        } else if (if_block) {
          if_block.d(1);
          if_block = null;
        }

        if (dirty & /*name*/ 2) {
          attr_dev(label_1, "for", /*name*/ ctx[1]);
        }
      },
      d: function destroy(detaching) {
        if (detaching) detach_dev(label_1);
        if (if_block) if_block.d();
      },
    };

    dispatch_dev("SvelteRegisterBlock", {
      block,
      id: create_if_block_2.name,
      type: "if",
      source: "(84:4) {#if label}",
      ctx,
    });

    return block;
  }

  // (86:15) {#if required}
  function create_if_block_3(ctx) {
    let span;

    const block = {
      c: function create() {
        span = element("span");
        span.textContent = "*";
        attr_dev(span, "class", "svelte-cgr9nh");
        add_location(span, file$6, 85, 29, 1783);
      },
      m: function mount(target, anchor) {
        insert_dev(target, span, anchor);
      },
      d: function destroy(detaching) {
        if (detaching) detach_dev(span);
      },
    };

    dispatch_dev("SvelteRegisterBlock", {
      block,
      id: create_if_block_3.name,
      type: "if",
      source: "(86:15) {#if required}",
      ctx,
    });

    return block;
  }

  // (89:4) {#if help && !error}
  function create_if_block_1$1(ctx) {
    let div;
    let t;

    const block = {
      c: function create() {
        div = element("div");
        t = text(/*help*/ ctx[6]);
        attr_dev(div, "class", "help svelte-cgr9nh");
        add_location(div, file$6, 89, 6, 1860);
      },
      m: function mount(target, anchor) {
        insert_dev(target, div, anchor);
        append_dev(div, t);
      },
      p: function update(ctx, dirty) {
        if (dirty & /*help*/ 64) set_data_dev(t, /*help*/ ctx[6]);
      },
      d: function destroy(detaching) {
        if (detaching) detach_dev(div);
      },
    };

    dispatch_dev("SvelteRegisterBlock", {
      block,
      id: create_if_block_1$1.name,
      type: "if",
      source: "(89:4) {#if help && !error}",
      ctx,
    });

    return block;
  }

  // (92:4) {#if error}
  function create_if_block$2(ctx) {
    let div;
    let t;

    const block = {
      c: function create() {
        div = element("div");
        t = text(/*error*/ ctx[7]);
        attr_dev(div, "class", "error svelte-cgr9nh");
        add_location(div, file$6, 92, 6, 1923);
      },
      m: function mount(target, anchor) {
        insert_dev(target, div, anchor);
        append_dev(div, t);
      },
      p: function update(ctx, dirty) {
        if (dirty & /*error*/ 128) set_data_dev(t, /*error*/ ctx[7]);
      },
      d: function destroy(detaching) {
        if (detaching) detach_dev(div);
      },
    };

    dispatch_dev("SvelteRegisterBlock", {
      block,
      id: create_if_block$2.name,
      type: "if",
      source: "(92:4) {#if error}",
      ctx,
    });

    return block;
  }

  function create_fragment$6(ctx) {
    let div1;
    let div0;
    let t0;
    let t1;
    let t2;
    let input;
    let mounted;
    let dispose;
    let if_block0 = /*label*/ ctx[4] && create_if_block_2(ctx);
    let if_block1 =
      /*help*/ ctx[6] && !(/*error*/ ctx[7]) && create_if_block_1$1(ctx);
    let if_block2 = /*error*/ ctx[7] && create_if_block$2(ctx);

    const block = {
      c: function create() {
        div1 = element("div");
        div0 = element("div");
        if (if_block0) if_block0.c();
        t0 = space();
        if (if_block1) if_block1.c();
        t1 = space();
        if (if_block2) if_block2.c();
        t2 = space();
        input = element("input");
        attr_dev(div0, "class", "top svelte-cgr9nh");
        add_location(div0, file$6, 82, 2, 1695);
        attr_dev(input, "type", /*type*/ ctx[3]);
        input.value = /*value*/ ctx[0];
        attr_dev(input, "placeholder", /*placeholder*/ ctx[2]);
        attr_dev(input, "name", /*name*/ ctx[1]);
        input.required = /*required*/ ctx[5];
        attr_dev(input, "class", "svelte-cgr9nh");
        add_location(input, file$6, 95, 2, 1977);
        attr_dev(div1, "class", "input svelte-cgr9nh");
        toggle_class(div1, "focused", /*focused*/ ctx[9]);
        toggle_class(div1, "error", !!(/*error*/ ctx[7]));
        add_location(div1, file$6, 81, 0, 1637);
      },
      l: function claim(nodes) {
        throw new Error(
          "options.hydrate only works if the component was compiled with the `hydratable: true` option"
        );
      },
      m: function mount(target, anchor) {
        insert_dev(target, div1, anchor);
        append_dev(div1, div0);
        if (if_block0) if_block0.m(div0, null);
        append_dev(div0, t0);
        if (if_block1) if_block1.m(div0, null);
        append_dev(div0, t1);
        if (if_block2) if_block2.m(div0, null);
        append_dev(div1, t2);
        append_dev(div1, input);
        /*input_binding*/ ctx[12](input);

        if (!mounted) {
          dispose = [
            listen_dev(
              input,
              "focus",
              /*focus_handler*/ ctx[13],
              false,
              false,
              false
            ),
            listen_dev(
              input,
              "blur",
              /*blur_handler*/ ctx[14],
              false,
              false,
              false
            ),
            listen_dev(
              input,
              "input",
              /*handleInput*/ ctx[10],
              false,
              false,
              false
            ),
          ];

          mounted = true;
        }
      },
      p: function update(ctx, [dirty]) {
        if (/*label*/ ctx[4]) {
          if (if_block0) {
            if_block0.p(ctx, dirty);
          } else {
            if_block0 = create_if_block_2(ctx);
            if_block0.c();
            if_block0.m(div0, t0);
          }
        } else if (if_block0) {
          if_block0.d(1);
          if_block0 = null;
        }

        if (/*help*/ ctx[6] && !(/*error*/ ctx[7])) {
          if (if_block1) {
            if_block1.p(ctx, dirty);
          } else {
            if_block1 = create_if_block_1$1(ctx);
            if_block1.c();
            if_block1.m(div0, t1);
          }
        } else if (if_block1) {
          if_block1.d(1);
          if_block1 = null;
        }

        if (/*error*/ ctx[7]) {
          if (if_block2) {
            if_block2.p(ctx, dirty);
          } else {
            if_block2 = create_if_block$2(ctx);
            if_block2.c();
            if_block2.m(div0, null);
          }
        } else if (if_block2) {
          if_block2.d(1);
          if_block2 = null;
        }

        if (dirty & /*type*/ 8) {
          attr_dev(input, "type", /*type*/ ctx[3]);
        }

        if (dirty & /*value*/ 1 && input.value !== /*value*/ ctx[0]) {
          prop_dev(input, "value", /*value*/ ctx[0]);
        }

        if (dirty & /*placeholder*/ 4) {
          attr_dev(input, "placeholder", /*placeholder*/ ctx[2]);
        }

        if (dirty & /*name*/ 2) {
          attr_dev(input, "name", /*name*/ ctx[1]);
        }

        if (dirty & /*required*/ 32) {
          prop_dev(input, "required", /*required*/ ctx[5]);
        }

        if (dirty & /*focused*/ 512) {
          toggle_class(div1, "focused", /*focused*/ ctx[9]);
        }

        if (dirty & /*error*/ 128) {
          toggle_class(div1, "error", !!(/*error*/ ctx[7]));
        }
      },
      i: noop,
      o: noop,
      d: function destroy(detaching) {
        if (detaching) detach_dev(div1);
        if (if_block0) if_block0.d();
        if (if_block1) if_block1.d();
        if (if_block2) if_block2.d();
        /*input_binding*/ ctx[12](null);
        mounted = false;
        run_all(dispose);
      },
    };

    dispatch_dev("SvelteRegisterBlock", {
      block,
      id: create_fragment$6.name,
      type: "component",
      source: "",
      ctx,
    });

    return block;
  }

  function instance$6($$self, $$props, $$invalidate) {
    let { $$slots: slots = {}, $$scope } = $$props;
    validate_slots("Input", slots, []);
    let { name } = $$props;
    let { placeholder = "" } = $$props;
    let { type = InputType.text } = $$props;
    let { value = "" } = $$props;
    let { label = "" } = $$props;
    let { required = false } = $$props;
    let { help = null } = $$props;
    let { error = null } = $$props;
    let { autofocus = false } = $$props;
    let inputElement;
    let focused = false;

    const handleInput = (e) => {
      // in here, you can switch on type and implement
      // whatever behaviour you need
      $$invalidate(
        0,
        (value = type.match(/^(number|range)$/)
          ? parseFloat(e.target.value)
          : e.target.value)
      );
    };

    const setFocus = () => inputElement.focus();

    onMount(() => {
      if (autofocus) setFocus();
    });

    const writable_props = [
      "name",
      "placeholder",
      "type",
      "value",
      "label",
      "required",
      "help",
      "error",
      "autofocus",
    ];

    Object.keys($$props).forEach((key) => {
      if (
        !~writable_props.indexOf(key) &&
        key.slice(0, 2) !== "$$" &&
        key !== "slot"
      )
        console.warn(`<Input> was created with unknown prop '${key}'`);
    });

    function input_binding($$value) {
      binding_callbacks[$$value ? "unshift" : "push"](() => {
        inputElement = $$value;
        $$invalidate(8, inputElement);
      });
    }

    const focus_handler = () => $$invalidate(9, (focused = true));
    const blur_handler = () => $$invalidate(9, (focused = false));

    $$self.$$set = ($$props) => {
      if ("name" in $$props) $$invalidate(1, (name = $$props.name));
      if ("placeholder" in $$props)
        $$invalidate(2, (placeholder = $$props.placeholder));
      if ("type" in $$props) $$invalidate(3, (type = $$props.type));
      if ("value" in $$props) $$invalidate(0, (value = $$props.value));
      if ("label" in $$props) $$invalidate(4, (label = $$props.label));
      if ("required" in $$props) $$invalidate(5, (required = $$props.required));
      if ("help" in $$props) $$invalidate(6, (help = $$props.help));
      if ("error" in $$props) $$invalidate(7, (error = $$props.error));
      if ("autofocus" in $$props)
        $$invalidate(11, (autofocus = $$props.autofocus));
    };

    $$self.$capture_state = () => ({
      onMount,
      InputType,
      name,
      placeholder,
      type,
      value,
      label,
      required,
      help,
      error,
      autofocus,
      inputElement,
      focused,
      handleInput,
      setFocus,
    });

    $$self.$inject_state = ($$props) => {
      if ("name" in $$props) $$invalidate(1, (name = $$props.name));
      if ("placeholder" in $$props)
        $$invalidate(2, (placeholder = $$props.placeholder));
      if ("type" in $$props) $$invalidate(3, (type = $$props.type));
      if ("value" in $$props) $$invalidate(0, (value = $$props.value));
      if ("label" in $$props) $$invalidate(4, (label = $$props.label));
      if ("required" in $$props) $$invalidate(5, (required = $$props.required));
      if ("help" in $$props) $$invalidate(6, (help = $$props.help));
      if ("error" in $$props) $$invalidate(7, (error = $$props.error));
      if ("autofocus" in $$props)
        $$invalidate(11, (autofocus = $$props.autofocus));
      if ("inputElement" in $$props)
        $$invalidate(8, (inputElement = $$props.inputElement));
      if ("focused" in $$props) $$invalidate(9, (focused = $$props.focused));
    };

    if ($$props && "$$inject" in $$props) {
      $$self.$inject_state($$props.$$inject);
    }

    return [
      value,
      name,
      placeholder,
      type,
      label,
      required,
      help,
      error,
      inputElement,
      focused,
      handleInput,
      autofocus,
      input_binding,
      focus_handler,
      blur_handler,
    ];
  }

  class Input extends SvelteComponentDev {
    constructor(options) {
      super(options);

      init(this, options, instance$6, create_fragment$6, safe_not_equal, {
        name: 1,
        placeholder: 2,
        type: 3,
        value: 0,
        label: 4,
        required: 5,
        help: 6,
        error: 7,
        autofocus: 11,
      });

      dispatch_dev("SvelteRegisterComponent", {
        component: this,
        tagName: "Input",
        options,
        id: create_fragment$6.name,
      });

      const { ctx } = this.$$;
      const props = options.props || {};

      if (/*name*/ ctx[1] === undefined && !("name" in props)) {
        console.warn("<Input> was created without expected prop 'name'");
      }
    }

    get name() {
      throw new Error(
        "<Input>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'"
      );
    }

    set name(value) {
      throw new Error(
        "<Input>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'"
      );
    }

    get placeholder() {
      throw new Error(
        "<Input>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'"
      );
    }

    set placeholder(value) {
      throw new Error(
        "<Input>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'"
      );
    }

    get type() {
      throw new Error(
        "<Input>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'"
      );
    }

    set type(value) {
      throw new Error(
        "<Input>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'"
      );
    }

    get value() {
      throw new Error(
        "<Input>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'"
      );
    }

    set value(value) {
      throw new Error(
        "<Input>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'"
      );
    }

    get label() {
      throw new Error(
        "<Input>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'"
      );
    }

    set label(value) {
      throw new Error(
        "<Input>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'"
      );
    }

    get required() {
      throw new Error(
        "<Input>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'"
      );
    }

    set required(value) {
      throw new Error(
        "<Input>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'"
      );
    }

    get help() {
      throw new Error(
        "<Input>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'"
      );
    }

    set help(value) {
      throw new Error(
        "<Input>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'"
      );
    }

    get error() {
      throw new Error(
        "<Input>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'"
      );
    }

    set error(value) {
      throw new Error(
        "<Input>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'"
      );
    }

    get autofocus() {
      throw new Error(
        "<Input>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'"
      );
    }

    set autofocus(value) {
      throw new Error(
        "<Input>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'"
      );
    }
  }

  /* src/components/Button.svelte generated by Svelte v3.42.1 */
  const file$5 = "src/components/Button.svelte";
  const get_icon_slot_changes = (dirty) => ({});
  const get_icon_slot_context = (ctx) => ({});

  function create_fragment$5(ctx) {
    let button;
    let t;
    let button_class_value;
    let current;
    let mounted;
    let dispose;
    const default_slot_template = /*#slots*/ ctx[7].default;
    const default_slot = create_slot(
      default_slot_template,
      ctx,
      /*$$scope*/ ctx[6],
      null
    );
    const icon_slot_template = /*#slots*/ ctx[7].icon;
    const icon_slot = create_slot(
      icon_slot_template,
      ctx,
      /*$$scope*/ ctx[6],
      get_icon_slot_context
    );

    const block = {
      c: function create() {
        button = element("button");
        if (default_slot) default_slot.c();
        t = space();
        if (icon_slot) icon_slot.c();
        attr_dev(button, "type", /*type*/ ctx[0]);
        set_style(button, "--color", "var(" + /*color*/ ctx[1] + ")");
        set_style(button, "--text-color", "var(" + /*textColor*/ ctx[2] + ")");
        attr_dev(
          button,
          "class",
          (button_class_value =
            "" + (null_to_empty(/*size*/ ctx[3]) + " svelte-jc25b"))
        );
        toggle_class(button, "focused", /*focused*/ ctx[5]);
        add_location(button, file$5, 41, 0, 955);
      },
      l: function claim(nodes) {
        throw new Error(
          "options.hydrate only works if the component was compiled with the `hydratable: true` option"
        );
      },
      m: function mount(target, anchor) {
        insert_dev(target, button, anchor);

        if (default_slot) {
          default_slot.m(button, null);
        }

        append_dev(button, t);

        if (icon_slot) {
          icon_slot.m(button, null);
        }

        current = true;

        if (!mounted) {
          dispose = [
            listen_dev(
              button,
              "click",
              function () {
                if (is_function(/*click*/ ctx[4]))
                  /*click*/ ctx[4].apply(this, arguments);
              },
              false,
              false,
              false
            ),
            listen_dev(
              button,
              "focus",
              /*focus_handler*/ ctx[8],
              false,
              false,
              false
            ),
            listen_dev(
              button,
              "blur",
              /*blur_handler*/ ctx[9],
              false,
              false,
              false
            ),
          ];

          mounted = true;
        }
      },
      p: function update(new_ctx, [dirty]) {
        ctx = new_ctx;

        if (default_slot) {
          if (default_slot.p && (!current || dirty & /*$$scope*/ 64)) {
            update_slot_base(
              default_slot,
              default_slot_template,
              ctx,
              /*$$scope*/ ctx[6],
              !current
                ? get_all_dirty_from_scope(/*$$scope*/ ctx[6])
                : get_slot_changes(
                    default_slot_template,
                    /*$$scope*/ ctx[6],
                    dirty,
                    null
                  ),
              null
            );
          }
        }

        if (icon_slot) {
          if (icon_slot.p && (!current || dirty & /*$$scope*/ 64)) {
            update_slot_base(
              icon_slot,
              icon_slot_template,
              ctx,
              /*$$scope*/ ctx[6],
              !current
                ? get_all_dirty_from_scope(/*$$scope*/ ctx[6])
                : get_slot_changes(
                    icon_slot_template,
                    /*$$scope*/ ctx[6],
                    dirty,
                    get_icon_slot_changes
                  ),
              get_icon_slot_context
            );
          }
        }

        if (!current || dirty & /*type*/ 1) {
          attr_dev(button, "type", /*type*/ ctx[0]);
        }

        if (!current || dirty & /*color*/ 2) {
          set_style(button, "--color", "var(" + /*color*/ ctx[1] + ")");
        }

        if (!current || dirty & /*textColor*/ 4) {
          set_style(
            button,
            "--text-color",
            "var(" + /*textColor*/ ctx[2] + ")"
          );
        }

        if (
          !current ||
          (dirty & /*size*/ 8 &&
            button_class_value !==
              (button_class_value =
                "" + (null_to_empty(/*size*/ ctx[3]) + " svelte-jc25b")))
        ) {
          attr_dev(button, "class", button_class_value);
        }

        if (dirty & /*size, focused*/ 40) {
          toggle_class(button, "focused", /*focused*/ ctx[5]);
        }
      },
      i: function intro(local) {
        if (current) return;
        transition_in(default_slot, local);
        transition_in(icon_slot, local);
        current = true;
      },
      o: function outro(local) {
        transition_out(default_slot, local);
        transition_out(icon_slot, local);
        current = false;
      },
      d: function destroy(detaching) {
        if (detaching) detach_dev(button);
        if (default_slot) default_slot.d(detaching);
        if (icon_slot) icon_slot.d(detaching);
        mounted = false;
        run_all(dispose);
      },
    };

    dispatch_dev("SvelteRegisterBlock", {
      block,
      id: create_fragment$5.name,
      type: "component",
      source: "",
      ctx,
    });

    return block;
  }

  function instance$5($$self, $$props, $$invalidate) {
    let { $$slots: slots = {}, $$scope } = $$props;
    validate_slots("Button", slots, ["default", "icon"]);
    let { type = ButtonType.submit } = $$props;
    let { color = Color.gray } = $$props;
    let { textColor = Color.white } = $$props;
    let { size = Size.md } = $$props;

    let { click = () => {} } = $$props;

    let focused = false;
    const writable_props = ["type", "color", "textColor", "size", "click"];

    Object.keys($$props).forEach((key) => {
      if (
        !~writable_props.indexOf(key) &&
        key.slice(0, 2) !== "$$" &&
        key !== "slot"
      )
        console.warn(`<Button> was created with unknown prop '${key}'`);
    });

    const focus_handler = () => $$invalidate(5, (focused = true));
    const blur_handler = () => $$invalidate(5, (focused = false));

    $$self.$$set = ($$props) => {
      if ("type" in $$props) $$invalidate(0, (type = $$props.type));
      if ("color" in $$props) $$invalidate(1, (color = $$props.color));
      if ("textColor" in $$props)
        $$invalidate(2, (textColor = $$props.textColor));
      if ("size" in $$props) $$invalidate(3, (size = $$props.size));
      if ("click" in $$props) $$invalidate(4, (click = $$props.click));
      if ("$$scope" in $$props) $$invalidate(6, ($$scope = $$props.$$scope));
    };

    $$self.$capture_state = () => ({
      ButtonType,
      Size,
      Color,
      type,
      color,
      textColor,
      size,
      click,
      focused,
    });

    $$self.$inject_state = ($$props) => {
      if ("type" in $$props) $$invalidate(0, (type = $$props.type));
      if ("color" in $$props) $$invalidate(1, (color = $$props.color));
      if ("textColor" in $$props)
        $$invalidate(2, (textColor = $$props.textColor));
      if ("size" in $$props) $$invalidate(3, (size = $$props.size));
      if ("click" in $$props) $$invalidate(4, (click = $$props.click));
      if ("focused" in $$props) $$invalidate(5, (focused = $$props.focused));
    };

    if ($$props && "$$inject" in $$props) {
      $$self.$inject_state($$props.$$inject);
    }

    return [
      type,
      color,
      textColor,
      size,
      click,
      focused,
      $$scope,
      slots,
      focus_handler,
      blur_handler,
    ];
  }

  class Button extends SvelteComponentDev {
    constructor(options) {
      super(options);

      init(this, options, instance$5, create_fragment$5, safe_not_equal, {
        type: 0,
        color: 1,
        textColor: 2,
        size: 3,
        click: 4,
      });

      dispatch_dev("SvelteRegisterComponent", {
        component: this,
        tagName: "Button",
        options,
        id: create_fragment$5.name,
      });
    }

    get type() {
      throw new Error(
        "<Button>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'"
      );
    }

    set type(value) {
      throw new Error(
        "<Button>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'"
      );
    }

    get color() {
      throw new Error(
        "<Button>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'"
      );
    }

    set color(value) {
      throw new Error(
        "<Button>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'"
      );
    }

    get textColor() {
      throw new Error(
        "<Button>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'"
      );
    }

    set textColor(value) {
      throw new Error(
        "<Button>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'"
      );
    }

    get size() {
      throw new Error(
        "<Button>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'"
      );
    }

    set size(value) {
      throw new Error(
        "<Button>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'"
      );
    }

    get click() {
      throw new Error(
        "<Button>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'"
      );
    }

    set click(value) {
      throw new Error(
        "<Button>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'"
      );
    }
  }

  /* src/views/SignIn.svelte generated by Svelte v3.42.1 */
  const file$4 = "src/views/SignIn.svelte";

  // (49:4) <Link to={paths.PASSWORD_RECOVERY}>
  function create_default_slot_2$3(ctx) {
    let t;

    const block = {
      c: function create() {
        t = text("Reset your password");
      },
      m: function mount(target, anchor) {
        insert_dev(target, t, anchor);
      },
      d: function destroy(detaching) {
        if (detaching) detach_dev(t);
      },
    };

    dispatch_dev("SvelteRegisterBlock", {
      block,
      id: create_default_slot_2$3.name,
      type: "slot",
      source: "(49:4) <Link to={paths.PASSWORD_RECOVERY}>",
      ctx,
    });

    return block;
  }

  // (66:4) <Button color={Color.primary}>
  function create_default_slot_1$3(ctx) {
    let t;

    const block = {
      c: function create() {
        t = text("Log in!");
      },
      m: function mount(target, anchor) {
        insert_dev(target, t, anchor);
      },
      d: function destroy(detaching) {
        if (detaching) detach_dev(t);
      },
    };

    dispatch_dev("SvelteRegisterBlock", {
      block,
      id: create_default_slot_1$3.name,
      type: "slot",
      source: "(66:4) <Button color={Color.primary}>",
      ctx,
    });

    return block;
  }

  // (45:0) <AuthLayout>
  function create_default_slot$3(ctx) {
    let h1;
    let t1;
    let p;
    let t2;
    let link;
    let t3;
    let t4;
    let form;
    let input0;
    let updating_value;
    let t5;
    let input1;
    let updating_value_1;
    let t6;
    let button;
    let current;
    let mounted;
    let dispose;

    link = new Link$1({
      props: {
        to: paths.PASSWORD_RECOVERY,
        $$slots: { default: [create_default_slot_2$3] },
        $$scope: { ctx },
      },
      $$inline: true,
    });

    function input0_value_binding(value) {
      /*input0_value_binding*/ ctx[3](value);
    }

    let input0_props = {
      autofocus: true,
      label: "E-mail or username",
      placeholder: "coolstreamer@gmail.com",
      error: getErrorFor("user_identifier", /*formError*/ ctx[1]),
      name: "user_identifier",
    };

    if (/*formData*/ ctx[0].userIdentifier !== void 0) {
      input0_props.value = /*formData*/ ctx[0].userIdentifier;
    }

    input0 = new Input({ props: input0_props, $$inline: true });
    binding_callbacks.push(() => bind(input0, "value", input0_value_binding));

    function input1_value_binding(value) {
      /*input1_value_binding*/ ctx[4](value);
    }

    let input1_props = {
      label: "Password",
      type: InputType.password,
      placeholder: "safetaters69",
      error: getErrorFor("password", /*formError*/ ctx[1]),
      name: "password",
    };

    if (/*formData*/ ctx[0].password !== void 0) {
      input1_props.value = /*formData*/ ctx[0].password;
    }

    input1 = new Input({ props: input1_props, $$inline: true });
    binding_callbacks.push(() => bind(input1, "value", input1_value_binding));

    button = new Button({
      props: {
        color: Color.primary,
        $$slots: { default: [create_default_slot_1$3] },
        $$scope: { ctx },
      },
      $$inline: true,
    });

    const block = {
      c: function create() {
        h1 = element("h1");
        h1.textContent = "Sign in";
        t1 = space();
        p = element("p");
        t2 = text("Having trouble?\n    ");
        create_component(link.$$.fragment);
        t3 = text("!");
        t4 = space();
        form = element("form");
        create_component(input0.$$.fragment);
        t5 = space();
        create_component(input1.$$.fragment);
        t6 = space();
        create_component(button.$$.fragment);
        attr_dev(h1, "class", "svelte-bwd7l6");
        add_location(h1, file$4, 45, 2, 1632);
        attr_dev(p, "class", "svelte-bwd7l6");
        add_location(p, file$4, 46, 2, 1651);
        add_location(form, file$4, 50, 2, 1751);
      },
      m: function mount(target, anchor) {
        insert_dev(target, h1, anchor);
        insert_dev(target, t1, anchor);
        insert_dev(target, p, anchor);
        append_dev(p, t2);
        mount_component(link, p, null);
        append_dev(p, t3);
        insert_dev(target, t4, anchor);
        insert_dev(target, form, anchor);
        mount_component(input0, form, null);
        append_dev(form, t5);
        mount_component(input1, form, null);
        append_dev(form, t6);
        mount_component(button, form, null);
        current = true;

        if (!mounted) {
          dispose = listen_dev(
            form,
            "submit",
            prevent_default(/*handleSubmit*/ ctx[2]),
            false,
            true,
            false
          );
          mounted = true;
        }
      },
      p: function update(ctx, dirty) {
        const link_changes = {};

        if (dirty & /*$$scope*/ 128) {
          link_changes.$$scope = { dirty, ctx };
        }

        link.$set(link_changes);
        const input0_changes = {};
        if (dirty & /*formError*/ 2)
          input0_changes.error = getErrorFor(
            "user_identifier",
            /*formError*/ ctx[1]
          );

        if (!updating_value && dirty & /*formData*/ 1) {
          updating_value = true;
          input0_changes.value = /*formData*/ ctx[0].userIdentifier;
          add_flush_callback(() => (updating_value = false));
        }

        input0.$set(input0_changes);
        const input1_changes = {};
        if (dirty & /*formError*/ 2)
          input1_changes.error = getErrorFor("password", /*formError*/ ctx[1]);

        if (!updating_value_1 && dirty & /*formData*/ 1) {
          updating_value_1 = true;
          input1_changes.value = /*formData*/ ctx[0].password;
          add_flush_callback(() => (updating_value_1 = false));
        }

        input1.$set(input1_changes);
        const button_changes = {};

        if (dirty & /*$$scope*/ 128) {
          button_changes.$$scope = { dirty, ctx };
        }

        button.$set(button_changes);
      },
      i: function intro(local) {
        if (current) return;
        transition_in(link.$$.fragment, local);
        transition_in(input0.$$.fragment, local);
        transition_in(input1.$$.fragment, local);
        transition_in(button.$$.fragment, local);
        current = true;
      },
      o: function outro(local) {
        transition_out(link.$$.fragment, local);
        transition_out(input0.$$.fragment, local);
        transition_out(input1.$$.fragment, local);
        transition_out(button.$$.fragment, local);
        current = false;
      },
      d: function destroy(detaching) {
        if (detaching) detach_dev(h1);
        if (detaching) detach_dev(t1);
        if (detaching) detach_dev(p);
        destroy_component(link);
        if (detaching) detach_dev(t4);
        if (detaching) detach_dev(form);
        destroy_component(input0);
        destroy_component(input1);
        destroy_component(button);
        mounted = false;
        dispose();
      },
    };

    dispatch_dev("SvelteRegisterBlock", {
      block,
      id: create_default_slot$3.name,
      type: "slot",
      source: "(45:0) <AuthLayout>",
      ctx,
    });

    return block;
  }

  function create_fragment$4(ctx) {
    let authlayout;
    let current;

    authlayout = new AuthLayout({
      props: {
        $$slots: { default: [create_default_slot$3] },
        $$scope: { ctx },
      },
      $$inline: true,
    });

    const block = {
      c: function create() {
        create_component(authlayout.$$.fragment);
      },
      l: function claim(nodes) {
        throw new Error(
          "options.hydrate only works if the component was compiled with the `hydratable: true` option"
        );
      },
      m: function mount(target, anchor) {
        mount_component(authlayout, target, anchor);
        current = true;
      },
      p: function update(ctx, [dirty]) {
        const authlayout_changes = {};

        if (dirty & /*$$scope, formError, formData*/ 131) {
          authlayout_changes.$$scope = { dirty, ctx };
        }

        authlayout.$set(authlayout_changes);
      },
      i: function intro(local) {
        if (current) return;
        transition_in(authlayout.$$.fragment, local);
        current = true;
      },
      o: function outro(local) {
        transition_out(authlayout.$$.fragment, local);
        current = false;
      },
      d: function destroy(detaching) {
        destroy_component(authlayout, detaching);
      },
    };

    dispatch_dev("SvelteRegisterBlock", {
      block,
      id: create_fragment$4.name,
      type: "component",
      source: "",
      ctx,
    });

    return block;
  }

  function instance$4($$self, $$props, $$invalidate) {
    let $api;
    validate_store(api, "api");
    component_subscribe($$self, api, ($$value) =>
      $$invalidate(5, ($api = $$value))
    );
    let { $$slots: slots = {}, $$scope } = $$props;
    validate_slots("SignIn", slots, []);

    var __awaiter =
      (this && this.__awaiter) ||
      function (thisArg, _arguments, P, generator) {
        function adopt(value) {
          return value instanceof P
            ? value
            : new P(function (resolve) {
                resolve(value);
              });
        }

        return new (P || (P = Promise))(function (resolve, reject) {
          function fulfilled(value) {
            try {
              step(generator.next(value));
            } catch (e) {
              reject(e);
            }
          }

          function rejected(value) {
            try {
              step(generator["throw"](value));
            } catch (e) {
              reject(e);
            }
          }

          function step(result) {
            result.done
              ? resolve(result.value)
              : adopt(result.value).then(fulfilled, rejected);
          }

          step((generator = generator.apply(thisArg, _arguments || [])).next());
        });
      };

    const formData = { userIdentifier: "", password: "" };
    let formError = null;

    const handleSubmit = () =>
      __awaiter(void 0, void 0, void 0, function* () {
        const response = yield $api("/api/auth/signin", {
          method: "POST",
          body: JSON.stringify(formData),
        });

        if (response.status === APIStatus.error)
          return $$invalidate(1, (formError = response.body));
        $$invalidate(1, (formError = null));
      });

    const writable_props = [];

    Object.keys($$props).forEach((key) => {
      if (
        !~writable_props.indexOf(key) &&
        key.slice(0, 2) !== "$$" &&
        key !== "slot"
      )
        console.warn(`<SignIn> was created with unknown prop '${key}'`);
    });

    function input0_value_binding(value) {
      if ($$self.$$.not_equal(formData.userIdentifier, value)) {
        formData.userIdentifier = value;
        $$invalidate(0, formData);
      }
    }

    function input1_value_binding(value) {
      if ($$self.$$.not_equal(formData.password, value)) {
        formData.password = value;
        $$invalidate(0, formData);
      }
    }

    $$self.$capture_state = () => ({
      __awaiter,
      Link: Link$1,
      paths,
      api,
      AuthLayout,
      Input,
      Button,
      APIStatus,
      Color,
      getErrorFor,
      InputType,
      formData,
      formError,
      handleSubmit,
      $api,
    });

    $$self.$inject_state = ($$props) => {
      if ("__awaiter" in $$props) __awaiter = $$props.__awaiter;
      if ("formError" in $$props)
        $$invalidate(1, (formError = $$props.formError));
    };

    if ($$props && "$$inject" in $$props) {
      $$self.$inject_state($$props.$$inject);
    }

    return [
      formData,
      formError,
      handleSubmit,
      input0_value_binding,
      input1_value_binding,
    ];
  }

  class SignIn extends SvelteComponentDev {
    constructor(options) {
      super(options);
      init(this, options, instance$4, create_fragment$4, safe_not_equal, {});

      dispatch_dev("SvelteRegisterComponent", {
        component: this,
        tagName: "SignIn",
        options,
        id: create_fragment$4.name,
      });
    }
  }

  /* src/components/Icon.svelte generated by Svelte v3.42.1 */
  const file$3 = "src/components/Icon.svelte";

  function create_fragment$3(ctx) {
    let i;
    let i_class_value;

    const block = {
      c: function create() {
        i = element("i");
        attr_dev(
          i,
          "class",
          (i_class_value = "icon las la-" + /*name*/ ctx[0] + " svelte-eosyd4")
        );
        set_style(i, "--size", "var(" + /*size*/ ctx[1] + ")");
        set_style(i, "--color", "var(" + /*color*/ ctx[2] + ")");
        add_location(i, file$3, 14, 0, 269);
      },
      l: function claim(nodes) {
        throw new Error(
          "options.hydrate only works if the component was compiled with the `hydratable: true` option"
        );
      },
      m: function mount(target, anchor) {
        insert_dev(target, i, anchor);
      },
      p: function update(ctx, [dirty]) {
        if (
          dirty & /*name*/ 1 &&
          i_class_value !==
            (i_class_value =
              "icon las la-" + /*name*/ ctx[0] + " svelte-eosyd4")
        ) {
          attr_dev(i, "class", i_class_value);
        }

        if (dirty & /*size*/ 2) {
          set_style(i, "--size", "var(" + /*size*/ ctx[1] + ")");
        }

        if (dirty & /*color*/ 4) {
          set_style(i, "--color", "var(" + /*color*/ ctx[2] + ")");
        }
      },
      i: noop,
      o: noop,
      d: function destroy(detaching) {
        if (detaching) detach_dev(i);
      },
    };

    dispatch_dev("SvelteRegisterBlock", {
      block,
      id: create_fragment$3.name,
      type: "component",
      source: "",
      ctx,
    });

    return block;
  }

  function instance$3($$self, $$props, $$invalidate) {
    let { $$slots: slots = {}, $$scope } = $$props;
    validate_slots("Icon", slots, []);
    let { name } = $$props;
    let { size = Gap.md } = $$props;
    let { color = Color.white } = $$props;
    const writable_props = ["name", "size", "color"];

    Object.keys($$props).forEach((key) => {
      if (
        !~writable_props.indexOf(key) &&
        key.slice(0, 2) !== "$$" &&
        key !== "slot"
      )
        console.warn(`<Icon> was created with unknown prop '${key}'`);
    });

    $$self.$$set = ($$props) => {
      if ("name" in $$props) $$invalidate(0, (name = $$props.name));
      if ("size" in $$props) $$invalidate(1, (size = $$props.size));
      if ("color" in $$props) $$invalidate(2, (color = $$props.color));
    };

    $$self.$capture_state = () => ({ Gap, Color, IconName, name, size, color });

    $$self.$inject_state = ($$props) => {
      if ("name" in $$props) $$invalidate(0, (name = $$props.name));
      if ("size" in $$props) $$invalidate(1, (size = $$props.size));
      if ("color" in $$props) $$invalidate(2, (color = $$props.color));
    };

    if ($$props && "$$inject" in $$props) {
      $$self.$inject_state($$props.$$inject);
    }

    return [name, size, color];
  }

  class Icon extends SvelteComponentDev {
    constructor(options) {
      super(options);
      init(this, options, instance$3, create_fragment$3, safe_not_equal, {
        name: 0,
        size: 1,
        color: 2,
      });

      dispatch_dev("SvelteRegisterComponent", {
        component: this,
        tagName: "Icon",
        options,
        id: create_fragment$3.name,
      });

      const { ctx } = this.$$;
      const props = options.props || {};

      if (/*name*/ ctx[0] === undefined && !("name" in props)) {
        console.warn("<Icon> was created without expected prop 'name'");
      }
    }

    get name() {
      throw new Error(
        "<Icon>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'"
      );
    }

    set name(value) {
      throw new Error(
        "<Icon>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'"
      );
    }

    get size() {
      throw new Error(
        "<Icon>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'"
      );
    }

    set size(value) {
      throw new Error(
        "<Icon>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'"
      );
    }

    get color() {
      throw new Error(
        "<Icon>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'"
      );
    }

    set color(value) {
      throw new Error(
        "<Icon>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'"
      );
    }
  }

  /* src/views/Onboarding.svelte generated by Svelte v3.42.1 */
  const file$2 = "src/views/Onboarding.svelte";

  // (74:2) {:catch error}
  function create_catch_block(ctx) {
    let p0;
    let icon;
    let t0;
    let h1;
    let t2;
    let t3_value = /*error*/ ctx[6] + "";
    let t3;
    let t4;
    let p1;
    let t6;
    let p2;
    let t7;
    let link0;
    let t8;
    let link1;
    let t9;
    let current;

    icon = new Icon({
      props: {
        name: IconName.skull_crossbones,
        size: Gap.xl,
      },
      $$inline: true,
    });

    link0 = new Link$1({
      props: {
        to: paths.PASSWORD_RECOVERY,
        $$slots: { default: [create_default_slot_6] },
        $$scope: { ctx },
      },
      $$inline: true,
    });

    link1 = new Link$1({
      props: {
        to: paths.LOGIN,
        $$slots: { default: [create_default_slot_5] },
        $$scope: { ctx },
      },
      $$inline: true,
    });

    const block = {
      c: function create() {
        p0 = element("p");
        create_component(icon.$$.fragment);
        t0 = space();
        h1 = element("h1");
        h1.textContent = "Damn";
        t2 = space();
        t3 = text(t3_value);
        t4 = space();
        p1 = element("p");
        p1.textContent = "Something went wrong.";
        t6 = space();
        p2 = element("p");
        t7 = text("Have you tried our\n      ");
        create_component(link0.$$.fragment);
        t8 = text("? Or\n      ");
        create_component(link1.$$.fragment);
        t9 = text("\n      if you've already got an account.");
        attr_dev(p0, "class", "svelte-gkby9");
        add_location(p0, file$2, 74, 4, 2425);
        attr_dev(h1, "class", "svelte-gkby9");
        add_location(h1, file$2, 77, 4, 2504);
        attr_dev(p1, "class", "svelte-gkby9");
        add_location(p1, file$2, 79, 4, 2534);
        attr_dev(p2, "class", "svelte-gkby9");
        add_location(p2, file$2, 80, 4, 2567);
      },
      m: function mount(target, anchor) {
        insert_dev(target, p0, anchor);
        mount_component(icon, p0, null);
        insert_dev(target, t0, anchor);
        insert_dev(target, h1, anchor);
        insert_dev(target, t2, anchor);
        insert_dev(target, t3, anchor);
        insert_dev(target, t4, anchor);
        insert_dev(target, p1, anchor);
        insert_dev(target, t6, anchor);
        insert_dev(target, p2, anchor);
        append_dev(p2, t7);
        mount_component(link0, p2, null);
        append_dev(p2, t8);
        mount_component(link1, p2, null);
        append_dev(p2, t9);
        current = true;
      },
      p: function update(ctx, dirty) {
        const link0_changes = {};

        if (dirty & /*$$scope*/ 128) {
          link0_changes.$$scope = { dirty, ctx };
        }

        link0.$set(link0_changes);
        const link1_changes = {};

        if (dirty & /*$$scope*/ 128) {
          link1_changes.$$scope = { dirty, ctx };
        }

        link1.$set(link1_changes);
      },
      i: function intro(local) {
        if (current) return;
        transition_in(icon.$$.fragment, local);
        transition_in(link0.$$.fragment, local);
        transition_in(link1.$$.fragment, local);
        current = true;
      },
      o: function outro(local) {
        transition_out(icon.$$.fragment, local);
        transition_out(link0.$$.fragment, local);
        transition_out(link1.$$.fragment, local);
        current = false;
      },
      d: function destroy(detaching) {
        if (detaching) detach_dev(p0);
        destroy_component(icon);
        if (detaching) detach_dev(t0);
        if (detaching) detach_dev(h1);
        if (detaching) detach_dev(t2);
        if (detaching) detach_dev(t3);
        if (detaching) detach_dev(t4);
        if (detaching) detach_dev(p1);
        if (detaching) detach_dev(t6);
        if (detaching) detach_dev(p2);
        destroy_component(link0);
        destroy_component(link1);
      },
    };

    dispatch_dev("SvelteRegisterBlock", {
      block,
      id: create_catch_block.name,
      type: "catch",
      source: "(74:2) {:catch error}",
      ctx,
    });

    return block;
  }

  // (83:6) <Link to={paths.PASSWORD_RECOVERY}>
  function create_default_slot_6(ctx) {
    let t;

    const block = {
      c: function create() {
        t = text("password recovery");
      },
      m: function mount(target, anchor) {
        insert_dev(target, t, anchor);
      },
      d: function destroy(detaching) {
        if (detaching) detach_dev(t);
      },
    };

    dispatch_dev("SvelteRegisterBlock", {
      block,
      id: create_default_slot_6.name,
      type: "slot",
      source: "(83:6) <Link to={paths.PASSWORD_RECOVERY}>",
      ctx,
    });

    return block;
  }

  // (84:6) <Link to={paths.LOGIN}>
  function create_default_slot_5(ctx) {
    let t;

    const block = {
      c: function create() {
        t = text("log in");
      },
      m: function mount(target, anchor) {
        insert_dev(target, t, anchor);
      },
      d: function destroy(detaching) {
        if (detaching) detach_dev(t);
      },
    };

    dispatch_dev("SvelteRegisterBlock", {
      block,
      id: create_default_slot_5.name,
      type: "slot",
      source: "(84:6) <Link to={paths.LOGIN}>",
      ctx,
    });

    return block;
  }

  // (49:2) {:then response}
  function create_then_block(ctx) {
    let current_block_type_index;
    let if_block;
    let if_block_anchor;
    let current;
    const if_block_creators = [create_if_block$1, create_else_block];
    const if_blocks = [];

    function select_block_type(ctx, dirty) {
      if (/*response*/ ctx[5].status === APIStatus.ok) return 0;
      return 1;
    }

    current_block_type_index = select_block_type(ctx);
    if_block = if_blocks[current_block_type_index] = if_block_creators[
      current_block_type_index
    ](ctx);

    const block = {
      c: function create() {
        if_block.c();
        if_block_anchor = empty();
      },
      m: function mount(target, anchor) {
        if_blocks[current_block_type_index].m(target, anchor);
        insert_dev(target, if_block_anchor, anchor);
        current = true;
      },
      p: function update(ctx, dirty) {
        if_block.p(ctx, dirty);
      },
      i: function intro(local) {
        if (current) return;
        transition_in(if_block);
        current = true;
      },
      o: function outro(local) {
        transition_out(if_block);
        current = false;
      },
      d: function destroy(detaching) {
        if_blocks[current_block_type_index].d(detaching);
        if (detaching) detach_dev(if_block_anchor);
      },
    };

    dispatch_dev("SvelteRegisterBlock", {
      block,
      id: create_then_block.name,
      type: "then",
      source: "(49:2) {:then response}",
      ctx,
    });

    return block;
  }

  // (61:4) {:else}
  function create_else_block(ctx) {
    let p0;
    let icon;
    let t0;
    let h1;
    let t2;
    let p1;
    let t3_value = getErrorFor("token", /*response*/ ctx[5].body) + "";
    let t3;
    let t4;
    let p2;
    let t5;
    let link0;
    let t6;
    let link1;
    let t7;
    let current;

    icon = new Icon({
      props: {
        name: IconName.skull_crossbones,
        size: Gap.xl,
      },
      $$inline: true,
    });

    link0 = new Link$1({
      props: {
        to: paths.PASSWORD_RECOVERY,
        $$slots: { default: [create_default_slot_4$1] },
        $$scope: { ctx },
      },
      $$inline: true,
    });

    link1 = new Link$1({
      props: {
        to: paths.LOGIN,
        $$slots: { default: [create_default_slot_3$1] },
        $$scope: { ctx },
      },
      $$inline: true,
    });

    const block = {
      c: function create() {
        p0 = element("p");
        create_component(icon.$$.fragment);
        t0 = space();
        h1 = element("h1");
        h1.textContent = "Damn";
        t2 = space();
        p1 = element("p");
        t3 = text(t3_value);
        t4 = space();
        p2 = element("p");
        t5 = text("Have you tried our\n        ");
        create_component(link0.$$.fragment);
        t6 = text("? Or\n        ");
        create_component(link1.$$.fragment);
        t7 = text("\n        if you've already got an account.");
        attr_dev(p0, "class", "svelte-gkby9");
        add_location(p0, file$2, 61, 6, 2037);
        attr_dev(h1, "class", "svelte-gkby9");
        add_location(h1, file$2, 64, 6, 2122);
        attr_dev(p1, "class", "svelte-gkby9");
        add_location(p1, file$2, 65, 6, 2142);
        attr_dev(p2, "class", "svelte-gkby9");
        add_location(p2, file$2, 66, 6, 2193);
      },
      m: function mount(target, anchor) {
        insert_dev(target, p0, anchor);
        mount_component(icon, p0, null);
        insert_dev(target, t0, anchor);
        insert_dev(target, h1, anchor);
        insert_dev(target, t2, anchor);
        insert_dev(target, p1, anchor);
        append_dev(p1, t3);
        insert_dev(target, t4, anchor);
        insert_dev(target, p2, anchor);
        append_dev(p2, t5);
        mount_component(link0, p2, null);
        append_dev(p2, t6);
        mount_component(link1, p2, null);
        append_dev(p2, t7);
        current = true;
      },
      p: function update(ctx, dirty) {
        const link0_changes = {};

        if (dirty & /*$$scope*/ 128) {
          link0_changes.$$scope = { dirty, ctx };
        }

        link0.$set(link0_changes);
        const link1_changes = {};

        if (dirty & /*$$scope*/ 128) {
          link1_changes.$$scope = { dirty, ctx };
        }

        link1.$set(link1_changes);
      },
      i: function intro(local) {
        if (current) return;
        transition_in(icon.$$.fragment, local);
        transition_in(link0.$$.fragment, local);
        transition_in(link1.$$.fragment, local);
        current = true;
      },
      o: function outro(local) {
        transition_out(icon.$$.fragment, local);
        transition_out(link0.$$.fragment, local);
        transition_out(link1.$$.fragment, local);
        current = false;
      },
      d: function destroy(detaching) {
        if (detaching) detach_dev(p0);
        destroy_component(icon);
        if (detaching) detach_dev(t0);
        if (detaching) detach_dev(h1);
        if (detaching) detach_dev(t2);
        if (detaching) detach_dev(p1);
        if (detaching) detach_dev(t4);
        if (detaching) detach_dev(p2);
        destroy_component(link0);
        destroy_component(link1);
      },
    };

    dispatch_dev("SvelteRegisterBlock", {
      block,
      id: create_else_block.name,
      type: "else",
      source: "(61:4) {:else}",
      ctx,
    });

    return block;
  }

  // (50:4) {#if response.status === APIStatus.ok}
  function create_if_block$1(ctx) {
    let p0;
    let icon;
    let t0;
    let h1;
    let t2;
    let p1;
    let t4;
    let p2;
    let link;
    let current;

    icon = new Icon({
      props: { name: IconName.thumbs_up, size: Gap.xl },
      $$inline: true,
    });

    link = new Link$1({
      props: {
        to: paths.LOGIN,
        $$slots: { default: [create_default_slot_1$2] },
        $$scope: { ctx },
      },
      $$inline: true,
    });

    const block = {
      c: function create() {
        p0 = element("p");
        create_component(icon.$$.fragment);
        t0 = space();
        h1 = element("h1");
        h1.textContent = "All good!";
        t2 = space();
        p1 = element("p");
        p1.textContent = "Yey! You're good to go.";
        t4 = space();
        p2 = element("p");
        create_component(link.$$.fragment);
        attr_dev(p0, "class", "svelte-gkby9");
        add_location(p0, file$2, 50, 6, 1759);
        attr_dev(h1, "class", "svelte-gkby9");
        add_location(h1, file$2, 53, 6, 1837);
        attr_dev(p1, "class", "svelte-gkby9");
        add_location(p1, file$2, 54, 6, 1862);
        attr_dev(p2, "class", "svelte-gkby9");
        add_location(p2, file$2, 55, 6, 1899);
      },
      m: function mount(target, anchor) {
        insert_dev(target, p0, anchor);
        mount_component(icon, p0, null);
        insert_dev(target, t0, anchor);
        insert_dev(target, h1, anchor);
        insert_dev(target, t2, anchor);
        insert_dev(target, p1, anchor);
        insert_dev(target, t4, anchor);
        insert_dev(target, p2, anchor);
        mount_component(link, p2, null);
        current = true;
      },
      p: function update(ctx, dirty) {
        const link_changes = {};

        if (dirty & /*$$scope*/ 128) {
          link_changes.$$scope = { dirty, ctx };
        }

        link.$set(link_changes);
      },
      i: function intro(local) {
        if (current) return;
        transition_in(icon.$$.fragment, local);
        transition_in(link.$$.fragment, local);
        current = true;
      },
      o: function outro(local) {
        transition_out(icon.$$.fragment, local);
        transition_out(link.$$.fragment, local);
        current = false;
      },
      d: function destroy(detaching) {
        if (detaching) detach_dev(p0);
        destroy_component(icon);
        if (detaching) detach_dev(t0);
        if (detaching) detach_dev(h1);
        if (detaching) detach_dev(t2);
        if (detaching) detach_dev(p1);
        if (detaching) detach_dev(t4);
        if (detaching) detach_dev(p2);
        destroy_component(link);
      },
    };

    dispatch_dev("SvelteRegisterBlock", {
      block,
      id: create_if_block$1.name,
      type: "if",
      source: "(50:4) {#if response.status === APIStatus.ok}",
      ctx,
    });

    return block;
  }

  // (69:8) <Link to={paths.PASSWORD_RECOVERY}>
  function create_default_slot_4$1(ctx) {
    let t;

    const block = {
      c: function create() {
        t = text("password recovery");
      },
      m: function mount(target, anchor) {
        insert_dev(target, t, anchor);
      },
      d: function destroy(detaching) {
        if (detaching) detach_dev(t);
      },
    };

    dispatch_dev("SvelteRegisterBlock", {
      block,
      id: create_default_slot_4$1.name,
      type: "slot",
      source: "(69:8) <Link to={paths.PASSWORD_RECOVERY}>",
      ctx,
    });

    return block;
  }

  // (70:8) <Link to={paths.LOGIN}>
  function create_default_slot_3$1(ctx) {
    let t;

    const block = {
      c: function create() {
        t = text("log in");
      },
      m: function mount(target, anchor) {
        insert_dev(target, t, anchor);
      },
      d: function destroy(detaching) {
        if (detaching) detach_dev(t);
      },
    };

    dispatch_dev("SvelteRegisterBlock", {
      block,
      id: create_default_slot_3$1.name,
      type: "slot",
      source: "(70:8) <Link to={paths.LOGIN}>",
      ctx,
    });

    return block;
  }

  // (58:10) <Button color={Color.primary}>
  function create_default_slot_2$2(ctx) {
    let t;

    const block = {
      c: function create() {
        t = text("Log in!");
      },
      m: function mount(target, anchor) {
        insert_dev(target, t, anchor);
      },
      d: function destroy(detaching) {
        if (detaching) detach_dev(t);
      },
    };

    dispatch_dev("SvelteRegisterBlock", {
      block,
      id: create_default_slot_2$2.name,
      type: "slot",
      source: "(58:10) <Button color={Color.primary}>",
      ctx,
    });

    return block;
  }

  // (57:8) <Link to={paths.LOGIN}>
  function create_default_slot_1$2(ctx) {
    let button;
    let current;

    button = new Button({
      props: {
        color: Color.primary,
        $$slots: { default: [create_default_slot_2$2] },
        $$scope: { ctx },
      },
      $$inline: true,
    });

    const block = {
      c: function create() {
        create_component(button.$$.fragment);
      },
      m: function mount(target, anchor) {
        mount_component(button, target, anchor);
        current = true;
      },
      p: function update(ctx, dirty) {
        const button_changes = {};

        if (dirty & /*$$scope*/ 128) {
          button_changes.$$scope = { dirty, ctx };
        }

        button.$set(button_changes);
      },
      i: function intro(local) {
        if (current) return;
        transition_in(button.$$.fragment, local);
        current = true;
      },
      o: function outro(local) {
        transition_out(button.$$.fragment, local);
        current = false;
      },
      d: function destroy(detaching) {
        destroy_component(button, detaching);
      },
    };

    dispatch_dev("SvelteRegisterBlock", {
      block,
      id: create_default_slot_1$2.name,
      type: "slot",
      source: "(57:8) <Link to={paths.LOGIN}>",
      ctx,
    });

    return block;
  }

  // (43:18)      <p>       <Icon name={IconName.newspaper}
  function create_pending_block(ctx) {
    let p0;
    let icon;
    let t0;
    let h1;
    let t2;
    let p1;
    let current;

    icon = new Icon({
      props: { name: IconName.newspaper, size: Gap.xl },
      $$inline: true,
    });

    const block = {
      c: function create() {
        p0 = element("p");
        create_component(icon.$$.fragment);
        t0 = space();
        h1 = element("h1");
        h1.textContent = "One sec...";
        t2 = space();
        p1 = element("p");
        p1.textContent = "Verifying your email...";
        attr_dev(p0, "class", "svelte-gkby9");
        add_location(p0, file$2, 43, 4, 1564);
        attr_dev(h1, "class", "svelte-gkby9");
        add_location(h1, file$2, 46, 4, 1636);
        attr_dev(p1, "class", "svelte-gkby9");
        add_location(p1, file$2, 47, 4, 1660);
      },
      m: function mount(target, anchor) {
        insert_dev(target, p0, anchor);
        mount_component(icon, p0, null);
        insert_dev(target, t0, anchor);
        insert_dev(target, h1, anchor);
        insert_dev(target, t2, anchor);
        insert_dev(target, p1, anchor);
        current = true;
      },
      p: noop,
      i: function intro(local) {
        if (current) return;
        transition_in(icon.$$.fragment, local);
        current = true;
      },
      o: function outro(local) {
        transition_out(icon.$$.fragment, local);
        current = false;
      },
      d: function destroy(detaching) {
        if (detaching) detach_dev(p0);
        destroy_component(icon);
        if (detaching) detach_dev(t0);
        if (detaching) detach_dev(h1);
        if (detaching) detach_dev(t2);
        if (detaching) detach_dev(p1);
      },
    };

    dispatch_dev("SvelteRegisterBlock", {
      block,
      id: create_pending_block.name,
      type: "pending",
      source: "(43:18)      <p>       <Icon name={IconName.newspaper}",
      ctx,
    });

    return block;
  }

  // (42:0) <AuthLayout>
  function create_default_slot$2(ctx) {
    let await_block_anchor;
    let current;

    let info = {
      ctx,
      current: null,
      token: null,
      hasCatch: true,
      pending: create_pending_block,
      then: create_then_block,
      catch: create_catch_block,
      value: 5,
      error: 6,
      blocks: [, , ,],
    };

    handle_promise(/*promise*/ ctx[0], info);

    const block = {
      c: function create() {
        await_block_anchor = empty();
        info.block.c();
      },
      m: function mount(target, anchor) {
        insert_dev(target, await_block_anchor, anchor);
        info.block.m(target, (info.anchor = anchor));
        info.mount = () => await_block_anchor.parentNode;
        info.anchor = await_block_anchor;
        current = true;
      },
      p: function update(new_ctx, dirty) {
        ctx = new_ctx;
        update_await_block_branch(info, ctx, dirty);
      },
      i: function intro(local) {
        if (current) return;
        transition_in(info.block);
        current = true;
      },
      o: function outro(local) {
        for (let i = 0; i < 3; i += 1) {
          const block = info.blocks[i];
          transition_out(block);
        }

        current = false;
      },
      d: function destroy(detaching) {
        if (detaching) detach_dev(await_block_anchor);
        info.block.d(detaching);
        info.token = null;
        info = null;
      },
    };

    dispatch_dev("SvelteRegisterBlock", {
      block,
      id: create_default_slot$2.name,
      type: "slot",
      source: "(42:0) <AuthLayout>",
      ctx,
    });

    return block;
  }

  function create_fragment$2(ctx) {
    let authlayout;
    let current;

    authlayout = new AuthLayout({
      props: {
        $$slots: { default: [create_default_slot$2] },
        $$scope: { ctx },
      },
      $$inline: true,
    });

    const block = {
      c: function create() {
        create_component(authlayout.$$.fragment);
      },
      l: function claim(nodes) {
        throw new Error(
          "options.hydrate only works if the component was compiled with the `hydratable: true` option"
        );
      },
      m: function mount(target, anchor) {
        mount_component(authlayout, target, anchor);
        current = true;
      },
      p: function update(ctx, [dirty]) {
        const authlayout_changes = {};

        if (dirty & /*$$scope*/ 128) {
          authlayout_changes.$$scope = { dirty, ctx };
        }

        authlayout.$set(authlayout_changes);
      },
      i: function intro(local) {
        if (current) return;
        transition_in(authlayout.$$.fragment, local);
        current = true;
      },
      o: function outro(local) {
        transition_out(authlayout.$$.fragment, local);
        current = false;
      },
      d: function destroy(detaching) {
        destroy_component(authlayout, detaching);
      },
    };

    dispatch_dev("SvelteRegisterBlock", {
      block,
      id: create_fragment$2.name,
      type: "component",
      source: "",
      ctx,
    });

    return block;
  }

  function instance$2($$self, $$props, $$invalidate) {
    let $api;
    validate_store(api, "api");
    component_subscribe($$self, api, ($$value) =>
      $$invalidate(1, ($api = $$value))
    );
    let { $$slots: slots = {}, $$scope } = $$props;
    validate_slots("Onboarding", slots, []);

    var __awaiter =
      (this && this.__awaiter) ||
      function (thisArg, _arguments, P, generator) {
        function adopt(value) {
          return value instanceof P
            ? value
            : new P(function (resolve) {
                resolve(value);
              });
        }

        return new (P || (P = Promise))(function (resolve, reject) {
          function fulfilled(value) {
            try {
              step(generator.next(value));
            } catch (e) {
              reject(e);
            }
          }

          function rejected(value) {
            try {
              step(generator["throw"](value));
            } catch (e) {
              reject(e);
            }
          }

          function step(result) {
            result.done
              ? resolve(result.value)
              : adopt(result.value).then(fulfilled, rejected);
          }

          step((generator = generator.apply(thisArg, _arguments || [])).next());
        });
      };

    const token = new URLSearchParams(window.location.search).get("token");

    const verifyToken = () =>
      __awaiter(void 0, void 0, void 0, function* () {
        return yield $api("/api/auth/onboard", {
          method: "POST",
          body: JSON.stringify({ token }),
        });
      });

    const promise = verifyToken();
    const writable_props = [];

    Object.keys($$props).forEach((key) => {
      if (
        !~writable_props.indexOf(key) &&
        key.slice(0, 2) !== "$$" &&
        key !== "slot"
      )
        console.warn(`<Onboarding> was created with unknown prop '${key}'`);
    });

    $$self.$capture_state = () => ({
      __awaiter,
      Link: Link$1,
      paths,
      api,
      AuthLayout,
      APIStatus,
      Color,
      Gap,
      getErrorFor,
      IconName,
      Icon,
      Button,
      token,
      verifyToken,
      promise,
      $api,
    });

    $$self.$inject_state = ($$props) => {
      if ("__awaiter" in $$props) __awaiter = $$props.__awaiter;
    };

    if ($$props && "$$inject" in $$props) {
      $$self.$inject_state($$props.$$inject);
    }

    return [promise];
  }

  class Onboarding extends SvelteComponentDev {
    constructor(options) {
      super(options);
      init(this, options, instance$2, create_fragment$2, safe_not_equal, {});

      dispatch_dev("SvelteRegisterComponent", {
        component: this,
        tagName: "Onboarding",
        options,
        id: create_fragment$2.name,
      });
    }
  }

  /* src/views/Register.svelte generated by Svelte v3.42.1 */
  const file$1 = "src/views/Register.svelte";

  // (52:2) {#if formSubmitted}
  function create_if_block_1(ctx) {
    let p0;
    let icon;
    let t0;
    let p1;
    let current;

    icon = new Icon({
      props: {
        name: IconName.mail_bulk,
        size: Gap.xl,
        color: Color.secondary,
      },
      $$inline: true,
    });

    const block = {
      c: function create() {
        p0 = element("p");
        create_component(icon.$$.fragment);
        t0 = space();
        p1 = element("p");
        p1.textContent =
          "Cool! Now check your email like the good grown-up you are to complete the\n      process.";
        attr_dev(p0, "class", "svelte-bwd7l6");
        add_location(p0, file$1, 52, 4, 1825);
        attr_dev(p1, "class", "svelte-bwd7l6");
        add_location(p1, file$1, 55, 4, 1921);
      },
      m: function mount(target, anchor) {
        insert_dev(target, p0, anchor);
        mount_component(icon, p0, null);
        insert_dev(target, t0, anchor);
        insert_dev(target, p1, anchor);
        current = true;
      },
      p: noop,
      i: function intro(local) {
        if (current) return;
        transition_in(icon.$$.fragment, local);
        current = true;
      },
      o: function outro(local) {
        transition_out(icon.$$.fragment, local);
        current = false;
      },
      d: function destroy(detaching) {
        if (detaching) detach_dev(p0);
        destroy_component(icon);
        if (detaching) detach_dev(t0);
        if (detaching) detach_dev(p1);
      },
    };

    dispatch_dev("SvelteRegisterBlock", {
      block,
      id: create_if_block_1.name,
      type: "if",
      source: "(52:2) {#if formSubmitted}",
      ctx,
    });

    return block;
  }

  // (63:4) <Link to={paths.SIGN_IN}>
  function create_default_slot_2$1(ctx) {
    let t;

    const block = {
      c: function create() {
        t = text("Log in");
      },
      m: function mount(target, anchor) {
        insert_dev(target, t, anchor);
      },
      d: function destroy(detaching) {
        if (detaching) detach_dev(t);
      },
    };

    dispatch_dev("SvelteRegisterBlock", {
      block,
      id: create_default_slot_2$1.name,
      type: "slot",
      source: "(63:4) <Link to={paths.SIGN_IN}>",
      ctx,
    });

    return block;
  }

  // (65:2) {#if !formSubmitted}
  function create_if_block(ctx) {
    let form;
    let input0;
    let updating_value;
    let t0;
    let input1;
    let updating_value_1;
    let t1;
    let input2;
    let updating_value_2;
    let t2;
    let input3;
    let updating_value_3;
    let t3;
    let button;
    let current;
    let mounted;
    let dispose;

    function input0_value_binding(value) {
      /*input0_value_binding*/ ctx[4](value);
    }

    let input0_props = {
      autofocus: true,
      label: "E-mail",
      placeholder: "coolstreamer@gmail.com",
      error: getErrorFor("email", /*formError*/ ctx[1]),
      name: "email",
    };

    if (/*formData*/ ctx[0].email !== void 0) {
      input0_props.value = /*formData*/ ctx[0].email;
    }

    input0 = new Input({ props: input0_props, $$inline: true });
    binding_callbacks.push(() => bind(input0, "value", input0_value_binding));

    function input1_value_binding(value) {
      /*input1_value_binding*/ ctx[5](value);
    }

    let input1_props = {
      label: "Username",
      placeholder: "coolstreamer69",
      error: getErrorFor("username", /*formError*/ ctx[1]),
      name: "username",
    };

    if (/*formData*/ ctx[0].username !== void 0) {
      input1_props.value = /*formData*/ ctx[0].username;
    }

    input1 = new Input({ props: input1_props, $$inline: true });
    binding_callbacks.push(() => bind(input1, "value", input1_value_binding));

    function input2_value_binding(value) {
      /*input2_value_binding*/ ctx[6](value);
    }

    let input2_props = {
      label: "Password",
      type: InputType.password,
      placeholder: "safetaters69",
      error: getErrorFor("password", /*formError*/ ctx[1]),
      name: "password",
    };

    if (/*formData*/ ctx[0].password !== void 0) {
      input2_props.value = /*formData*/ ctx[0].password;
    }

    input2 = new Input({ props: input2_props, $$inline: true });
    binding_callbacks.push(() => bind(input2, "value", input2_value_binding));

    function input3_value_binding(value) {
      /*input3_value_binding*/ ctx[7](value);
    }

    let input3_props = {
      label: "Repeat password",
      type: InputType.password,
      placeholder: "safetaters69",
      error: getErrorFor("confirm_password", /*formError*/ ctx[1]),
      name: "confirm-password",
    };

    if (/*formData*/ ctx[0].confirmPassword !== void 0) {
      input3_props.value = /*formData*/ ctx[0].confirmPassword;
    }

    input3 = new Input({ props: input3_props, $$inline: true });
    binding_callbacks.push(() => bind(input3, "value", input3_value_binding));

    button = new Button({
      props: {
        color: Color.primary,
        $$slots: { default: [create_default_slot_1$1] },
        $$scope: { ctx },
      },
      $$inline: true,
    });

    const block = {
      c: function create() {
        form = element("form");
        create_component(input0.$$.fragment);
        t0 = space();
        create_component(input1.$$.fragment);
        t1 = space();
        create_component(input2.$$.fragment);
        t2 = space();
        create_component(input3.$$.fragment);
        t3 = space();
        create_component(button.$$.fragment);
        add_location(form, file$1, 65, 4, 2149);
      },
      m: function mount(target, anchor) {
        insert_dev(target, form, anchor);
        mount_component(input0, form, null);
        append_dev(form, t0);
        mount_component(input1, form, null);
        append_dev(form, t1);
        mount_component(input2, form, null);
        append_dev(form, t2);
        mount_component(input3, form, null);
        append_dev(form, t3);
        mount_component(button, form, null);
        current = true;

        if (!mounted) {
          dispose = listen_dev(
            form,
            "submit",
            prevent_default(/*handleSubmit*/ ctx[3]),
            false,
            true,
            false
          );
          mounted = true;
        }
      },
      p: function update(ctx, dirty) {
        const input0_changes = {};
        if (dirty & /*formError*/ 2)
          input0_changes.error = getErrorFor("email", /*formError*/ ctx[1]);

        if (!updating_value && dirty & /*formData*/ 1) {
          updating_value = true;
          input0_changes.value = /*formData*/ ctx[0].email;
          add_flush_callback(() => (updating_value = false));
        }

        input0.$set(input0_changes);
        const input1_changes = {};
        if (dirty & /*formError*/ 2)
          input1_changes.error = getErrorFor("username", /*formError*/ ctx[1]);

        if (!updating_value_1 && dirty & /*formData*/ 1) {
          updating_value_1 = true;
          input1_changes.value = /*formData*/ ctx[0].username;
          add_flush_callback(() => (updating_value_1 = false));
        }

        input1.$set(input1_changes);
        const input2_changes = {};
        if (dirty & /*formError*/ 2)
          input2_changes.error = getErrorFor("password", /*formError*/ ctx[1]);

        if (!updating_value_2 && dirty & /*formData*/ 1) {
          updating_value_2 = true;
          input2_changes.value = /*formData*/ ctx[0].password;
          add_flush_callback(() => (updating_value_2 = false));
        }

        input2.$set(input2_changes);
        const input3_changes = {};
        if (dirty & /*formError*/ 2)
          input3_changes.error = getErrorFor(
            "confirm_password",
            /*formError*/ ctx[1]
          );

        if (!updating_value_3 && dirty & /*formData*/ 1) {
          updating_value_3 = true;
          input3_changes.value = /*formData*/ ctx[0].confirmPassword;
          add_flush_callback(() => (updating_value_3 = false));
        }

        input3.$set(input3_changes);
        const button_changes = {};

        if (dirty & /*$$scope*/ 1024) {
          button_changes.$$scope = { dirty, ctx };
        }

        button.$set(button_changes);
      },
      i: function intro(local) {
        if (current) return;
        transition_in(input0.$$.fragment, local);
        transition_in(input1.$$.fragment, local);
        transition_in(input2.$$.fragment, local);
        transition_in(input3.$$.fragment, local);
        transition_in(button.$$.fragment, local);
        current = true;
      },
      o: function outro(local) {
        transition_out(input0.$$.fragment, local);
        transition_out(input1.$$.fragment, local);
        transition_out(input2.$$.fragment, local);
        transition_out(input3.$$.fragment, local);
        transition_out(button.$$.fragment, local);
        current = false;
      },
      d: function destroy(detaching) {
        if (detaching) detach_dev(form);
        destroy_component(input0);
        destroy_component(input1);
        destroy_component(input2);
        destroy_component(input3);
        destroy_component(button);
        mounted = false;
        dispose();
      },
    };

    dispatch_dev("SvelteRegisterBlock", {
      block,
      id: create_if_block.name,
      type: "if",
      source: "(65:2) {#if !formSubmitted}",
      ctx,
    });

    return block;
  }

  // (94:6) <Button color={Color.primary}>
  function create_default_slot_1$1(ctx) {
    let t;

    const block = {
      c: function create() {
        t = text("Get started!");
      },
      m: function mount(target, anchor) {
        insert_dev(target, t, anchor);
      },
      d: function destroy(detaching) {
        if (detaching) detach_dev(t);
      },
    };

    dispatch_dev("SvelteRegisterBlock", {
      block,
      id: create_default_slot_1$1.name,
      type: "slot",
      source: "(94:6) <Button color={Color.primary}>",
      ctx,
    });

    return block;
  }

  // (50:0) <AuthLayout>
  function create_default_slot$1(ctx) {
    let h1;
    let t1;
    let t2;
    let p;
    let t3;
    let link;
    let t4;
    let t5;
    let if_block1_anchor;
    let current;
    let if_block0 = /*formSubmitted*/ ctx[2] && create_if_block_1(ctx);

    link = new Link$1({
      props: {
        to: paths.SIGN_IN,
        $$slots: { default: [create_default_slot_2$1] },
        $$scope: { ctx },
      },
      $$inline: true,
    });

    let if_block1 = !(/*formSubmitted*/ ctx[2]) && create_if_block(ctx);

    const block = {
      c: function create() {
        h1 = element("h1");
        h1.textContent = "Sign up";
        t1 = space();
        if (if_block0) if_block0.c();
        t2 = space();
        p = element("p");
        t3 = text("Already got an account?\n    ");
        create_component(link.$$.fragment);
        t4 = text("!");
        t5 = space();
        if (if_block1) if_block1.c();
        if_block1_anchor = empty();
        attr_dev(h1, "class", "svelte-bwd7l6");
        add_location(h1, file$1, 50, 2, 1782);
        attr_dev(p, "class", "svelte-bwd7l6");
        add_location(p, file$1, 60, 2, 2039);
      },
      m: function mount(target, anchor) {
        insert_dev(target, h1, anchor);
        insert_dev(target, t1, anchor);
        if (if_block0) if_block0.m(target, anchor);
        insert_dev(target, t2, anchor);
        insert_dev(target, p, anchor);
        append_dev(p, t3);
        mount_component(link, p, null);
        append_dev(p, t4);
        insert_dev(target, t5, anchor);
        if (if_block1) if_block1.m(target, anchor);
        insert_dev(target, if_block1_anchor, anchor);
        current = true;
      },
      p: function update(ctx, dirty) {
        if (/*formSubmitted*/ ctx[2]) {
          if (if_block0) {
            if_block0.p(ctx, dirty);

            if (dirty & /*formSubmitted*/ 4) {
              transition_in(if_block0, 1);
            }
          } else {
            if_block0 = create_if_block_1(ctx);
            if_block0.c();
            transition_in(if_block0, 1);
            if_block0.m(t2.parentNode, t2);
          }
        } else if (if_block0) {
          group_outros();

          transition_out(if_block0, 1, 1, () => {
            if_block0 = null;
          });

          check_outros();
        }

        const link_changes = {};

        if (dirty & /*$$scope*/ 1024) {
          link_changes.$$scope = { dirty, ctx };
        }

        link.$set(link_changes);

        if (!(/*formSubmitted*/ ctx[2])) {
          if (if_block1) {
            if_block1.p(ctx, dirty);

            if (dirty & /*formSubmitted*/ 4) {
              transition_in(if_block1, 1);
            }
          } else {
            if_block1 = create_if_block(ctx);
            if_block1.c();
            transition_in(if_block1, 1);
            if_block1.m(if_block1_anchor.parentNode, if_block1_anchor);
          }
        } else if (if_block1) {
          group_outros();

          transition_out(if_block1, 1, 1, () => {
            if_block1 = null;
          });

          check_outros();
        }
      },
      i: function intro(local) {
        if (current) return;
        transition_in(if_block0);
        transition_in(link.$$.fragment, local);
        transition_in(if_block1);
        current = true;
      },
      o: function outro(local) {
        transition_out(if_block0);
        transition_out(link.$$.fragment, local);
        transition_out(if_block1);
        current = false;
      },
      d: function destroy(detaching) {
        if (detaching) detach_dev(h1);
        if (detaching) detach_dev(t1);
        if (if_block0) if_block0.d(detaching);
        if (detaching) detach_dev(t2);
        if (detaching) detach_dev(p);
        destroy_component(link);
        if (detaching) detach_dev(t5);
        if (if_block1) if_block1.d(detaching);
        if (detaching) detach_dev(if_block1_anchor);
      },
    };

    dispatch_dev("SvelteRegisterBlock", {
      block,
      id: create_default_slot$1.name,
      type: "slot",
      source: "(50:0) <AuthLayout>",
      ctx,
    });

    return block;
  }

  function create_fragment$1(ctx) {
    let authlayout;
    let current;

    authlayout = new AuthLayout({
      props: {
        $$slots: { default: [create_default_slot$1] },
        $$scope: { ctx },
      },
      $$inline: true,
    });

    const block = {
      c: function create() {
        create_component(authlayout.$$.fragment);
      },
      l: function claim(nodes) {
        throw new Error(
          "options.hydrate only works if the component was compiled with the `hydratable: true` option"
        );
      },
      m: function mount(target, anchor) {
        mount_component(authlayout, target, anchor);
        current = true;
      },
      p: function update(ctx, [dirty]) {
        const authlayout_changes = {};

        if (dirty & /*$$scope, formError, formData, formSubmitted*/ 1031) {
          authlayout_changes.$$scope = { dirty, ctx };
        }

        authlayout.$set(authlayout_changes);
      },
      i: function intro(local) {
        if (current) return;
        transition_in(authlayout.$$.fragment, local);
        current = true;
      },
      o: function outro(local) {
        transition_out(authlayout.$$.fragment, local);
        current = false;
      },
      d: function destroy(detaching) {
        destroy_component(authlayout, detaching);
      },
    };

    dispatch_dev("SvelteRegisterBlock", {
      block,
      id: create_fragment$1.name,
      type: "component",
      source: "",
      ctx,
    });

    return block;
  }

  function instance$1($$self, $$props, $$invalidate) {
    let $api;
    validate_store(api, "api");
    component_subscribe($$self, api, ($$value) =>
      $$invalidate(8, ($api = $$value))
    );
    let { $$slots: slots = {}, $$scope } = $$props;
    validate_slots("Register", slots, []);

    var __awaiter =
      (this && this.__awaiter) ||
      function (thisArg, _arguments, P, generator) {
        function adopt(value) {
          return value instanceof P
            ? value
            : new P(function (resolve) {
                resolve(value);
              });
        }

        return new (P || (P = Promise))(function (resolve, reject) {
          function fulfilled(value) {
            try {
              step(generator.next(value));
            } catch (e) {
              reject(e);
            }
          }

          function rejected(value) {
            try {
              step(generator["throw"](value));
            } catch (e) {
              reject(e);
            }
          }

          function step(result) {
            result.done
              ? resolve(result.value)
              : adopt(result.value).then(fulfilled, rejected);
          }

          step((generator = generator.apply(thisArg, _arguments || [])).next());
        });
      };

    const formData = {
      email: "",
      password: "",
      confirmPassword: "",
      username: "",
    };

    let formError = null;
    let formSubmitted = false;

    const handleSubmit = () =>
      __awaiter(void 0, void 0, void 0, function* () {
        const response = yield $api("/api/auth/register", {
          method: "POST",
          body: JSON.stringify(formData),
        });

        if (response.status === APIStatus.error)
          return $$invalidate(1, (formError = response.body));
        $$invalidate(1, (formError = null));
        $$invalidate(2, (formSubmitted = true));
      });

    const writable_props = [];

    Object.keys($$props).forEach((key) => {
      if (
        !~writable_props.indexOf(key) &&
        key.slice(0, 2) !== "$$" &&
        key !== "slot"
      )
        console.warn(`<Register> was created with unknown prop '${key}'`);
    });

    function input0_value_binding(value) {
      if ($$self.$$.not_equal(formData.email, value)) {
        formData.email = value;
        $$invalidate(0, formData);
      }
    }

    function input1_value_binding(value) {
      if ($$self.$$.not_equal(formData.username, value)) {
        formData.username = value;
        $$invalidate(0, formData);
      }
    }

    function input2_value_binding(value) {
      if ($$self.$$.not_equal(formData.password, value)) {
        formData.password = value;
        $$invalidate(0, formData);
      }
    }

    function input3_value_binding(value) {
      if ($$self.$$.not_equal(formData.confirmPassword, value)) {
        formData.confirmPassword = value;
        $$invalidate(0, formData);
      }
    }

    $$self.$capture_state = () => ({
      __awaiter,
      Link: Link$1,
      paths,
      api,
      AuthLayout,
      Input,
      Button,
      APIStatus,
      Color,
      Gap,
      getErrorFor,
      IconName,
      InputType,
      Icon,
      formData,
      formError,
      formSubmitted,
      handleSubmit,
      $api,
    });

    $$self.$inject_state = ($$props) => {
      if ("__awaiter" in $$props) __awaiter = $$props.__awaiter;
      if ("formError" in $$props)
        $$invalidate(1, (formError = $$props.formError));
      if ("formSubmitted" in $$props)
        $$invalidate(2, (formSubmitted = $$props.formSubmitted));
    };

    if ($$props && "$$inject" in $$props) {
      $$self.$inject_state($$props.$$inject);
    }

    return [
      formData,
      formError,
      formSubmitted,
      handleSubmit,
      input0_value_binding,
      input1_value_binding,
      input2_value_binding,
      input3_value_binding,
    ];
  }

  class Register extends SvelteComponentDev {
    constructor(options) {
      super(options);
      init(this, options, instance$1, create_fragment$1, safe_not_equal, {});

      dispatch_dev("SvelteRegisterComponent", {
        component: this,
        tagName: "Register",
        options,
        id: create_fragment$1.name,
      });
    }
  }

  /* src/App.svelte generated by Svelte v3.42.1 */
  const file = "src/App.svelte";

  // (17:6) <Link to={paths.HOME}>
  function create_default_slot_4(ctx) {
    let t;

    const block = {
      c: function create() {
        t = text("Home");
      },
      m: function mount(target, anchor) {
        insert_dev(target, t, anchor);
      },
      d: function destroy(detaching) {
        if (detaching) detach_dev(t);
      },
    };

    dispatch_dev("SvelteRegisterBlock", {
      block,
      id: create_default_slot_4.name,
      type: "slot",
      source: "(17:6) <Link to={paths.HOME}>",
      ctx,
    });

    return block;
  }

  // (18:6) <Link to={paths.SIGN_IN}>
  function create_default_slot_3(ctx) {
    let t;

    const block = {
      c: function create() {
        t = text("Sign in");
      },
      m: function mount(target, anchor) {
        insert_dev(target, t, anchor);
      },
      d: function destroy(detaching) {
        if (detaching) detach_dev(t);
      },
    };

    dispatch_dev("SvelteRegisterBlock", {
      block,
      id: create_default_slot_3.name,
      type: "slot",
      source: "(18:6) <Link to={paths.SIGN_IN}>",
      ctx,
    });

    return block;
  }

  // (19:6) <Link to={paths.REGISTER}>
  function create_default_slot_2(ctx) {
    let t;

    const block = {
      c: function create() {
        t = text("Register");
      },
      m: function mount(target, anchor) {
        insert_dev(target, t, anchor);
      },
      d: function destroy(detaching) {
        if (detaching) detach_dev(t);
      },
    };

    dispatch_dev("SvelteRegisterBlock", {
      block,
      id: create_default_slot_2.name,
      type: "slot",
      source: "(19:6) <Link to={paths.REGISTER}>",
      ctx,
    });

    return block;
  }

  // (22:6) <Route path={paths.HOME}>
  function create_default_slot_1(ctx) {
    let home;
    let current;
    home = new Home({ $$inline: true });

    const block = {
      c: function create() {
        create_component(home.$$.fragment);
      },
      m: function mount(target, anchor) {
        mount_component(home, target, anchor);
        current = true;
      },
      i: function intro(local) {
        if (current) return;
        transition_in(home.$$.fragment, local);
        current = true;
      },
      o: function outro(local) {
        transition_out(home.$$.fragment, local);
        current = false;
      },
      d: function destroy(detaching) {
        destroy_component(home, detaching);
      },
    };

    dispatch_dev("SvelteRegisterBlock", {
      block,
      id: create_default_slot_1.name,
      type: "slot",
      source: "(22:6) <Route path={paths.HOME}>",
      ctx,
    });

    return block;
  }

  // (15:2) <Router>
  function create_default_slot(ctx) {
    let nav;
    let link0;
    let t0;
    let link1;
    let t1;
    let link2;
    let t2;
    let div;
    let route0;
    let t3;
    let route1;
    let t4;
    let route2;
    let t5;
    let route3;
    let current;

    link0 = new Link$1({
      props: {
        to: paths.HOME,
        $$slots: { default: [create_default_slot_4] },
        $$scope: { ctx },
      },
      $$inline: true,
    });

    link1 = new Link$1({
      props: {
        to: paths.SIGN_IN,
        $$slots: { default: [create_default_slot_3] },
        $$scope: { ctx },
      },
      $$inline: true,
    });

    link2 = new Link$1({
      props: {
        to: paths.REGISTER,
        $$slots: { default: [create_default_slot_2] },
        $$scope: { ctx },
      },
      $$inline: true,
    });

    route0 = new Route$1({
      props: {
        path: paths.HOME,
        $$slots: { default: [create_default_slot_1] },
        $$scope: { ctx },
      },
      $$inline: true,
    });

    route1 = new Route$1({
      props: { path: paths.SIGN_IN, component: SignIn },
      $$inline: true,
    });

    route2 = new Route$1({
      props: {
        path: paths.REGISTER,
        component: Register,
      },
      $$inline: true,
    });

    route3 = new Route$1({
      props: {
        path: paths.ONBOARDING,
        component: Onboarding,
      },
      $$inline: true,
    });

    const block = {
      c: function create() {
        nav = element("nav");
        create_component(link0.$$.fragment);
        t0 = space();
        create_component(link1.$$.fragment);
        t1 = space();
        create_component(link2.$$.fragment);
        t2 = space();
        div = element("div");
        create_component(route0.$$.fragment);
        t3 = space();
        create_component(route1.$$.fragment);
        t4 = space();
        create_component(route2.$$.fragment);
        t5 = space();
        create_component(route3.$$.fragment);
        add_location(nav, file, 15, 4, 388);
        add_location(div, file, 20, 4, 543);
      },
      m: function mount(target, anchor) {
        insert_dev(target, nav, anchor);
        mount_component(link0, nav, null);
        append_dev(nav, t0);
        mount_component(link1, nav, null);
        append_dev(nav, t1);
        mount_component(link2, nav, null);
        insert_dev(target, t2, anchor);
        insert_dev(target, div, anchor);
        mount_component(route0, div, null);
        append_dev(div, t3);
        mount_component(route1, div, null);
        append_dev(div, t4);
        mount_component(route2, div, null);
        append_dev(div, t5);
        mount_component(route3, div, null);
        current = true;
      },
      p: function update(ctx, dirty) {
        const link0_changes = {};

        if (dirty & /*$$scope*/ 2) {
          link0_changes.$$scope = { dirty, ctx };
        }

        link0.$set(link0_changes);
        const link1_changes = {};

        if (dirty & /*$$scope*/ 2) {
          link1_changes.$$scope = { dirty, ctx };
        }

        link1.$set(link1_changes);
        const link2_changes = {};

        if (dirty & /*$$scope*/ 2) {
          link2_changes.$$scope = { dirty, ctx };
        }

        link2.$set(link2_changes);
        const route0_changes = {};

        if (dirty & /*$$scope*/ 2) {
          route0_changes.$$scope = { dirty, ctx };
        }

        route0.$set(route0_changes);
      },
      i: function intro(local) {
        if (current) return;
        transition_in(link0.$$.fragment, local);
        transition_in(link1.$$.fragment, local);
        transition_in(link2.$$.fragment, local);
        transition_in(route0.$$.fragment, local);
        transition_in(route1.$$.fragment, local);
        transition_in(route2.$$.fragment, local);
        transition_in(route3.$$.fragment, local);
        current = true;
      },
      o: function outro(local) {
        transition_out(link0.$$.fragment, local);
        transition_out(link1.$$.fragment, local);
        transition_out(link2.$$.fragment, local);
        transition_out(route0.$$.fragment, local);
        transition_out(route1.$$.fragment, local);
        transition_out(route2.$$.fragment, local);
        transition_out(route3.$$.fragment, local);
        current = false;
      },
      d: function destroy(detaching) {
        if (detaching) detach_dev(nav);
        destroy_component(link0);
        destroy_component(link1);
        destroy_component(link2);
        if (detaching) detach_dev(t2);
        if (detaching) detach_dev(div);
        destroy_component(route0);
        destroy_component(route1);
        destroy_component(route2);
        destroy_component(route3);
      },
    };

    dispatch_dev("SvelteRegisterBlock", {
      block,
      id: create_default_slot.name,
      type: "slot",
      source: "(15:2) <Router>",
      ctx,
    });

    return block;
  }

  function create_fragment(ctx) {
    let main;
    let h1;
    let t0;
    let t1;
    let t2;
    let t3;
    let router;
    let current;

    router = new Router$1({
      props: {
        $$slots: { default: [create_default_slot] },
        $$scope: { ctx },
      },
      $$inline: true,
    });

    const block = {
      c: function create() {
        main = element("main");
        h1 = element("h1");
        t0 = text("Hello ");
        t1 = text(/*name*/ ctx[0]);
        t2 = text("!");
        t3 = space();
        create_component(router.$$.fragment);
        add_location(h1, file, 13, 2, 350);
        add_location(main, file, 12, 0, 341);
      },
      l: function claim(nodes) {
        throw new Error(
          "options.hydrate only works if the component was compiled with the `hydratable: true` option"
        );
      },
      m: function mount(target, anchor) {
        insert_dev(target, main, anchor);
        append_dev(main, h1);
        append_dev(h1, t0);
        append_dev(h1, t1);
        append_dev(h1, t2);
        append_dev(main, t3);
        mount_component(router, main, null);
        current = true;
      },
      p: function update(ctx, [dirty]) {
        if (!current || dirty & /*name*/ 1) set_data_dev(t1, /*name*/ ctx[0]);
        const router_changes = {};

        if (dirty & /*$$scope*/ 2) {
          router_changes.$$scope = { dirty, ctx };
        }

        router.$set(router_changes);
      },
      i: function intro(local) {
        if (current) return;
        transition_in(router.$$.fragment, local);
        current = true;
      },
      o: function outro(local) {
        transition_out(router.$$.fragment, local);
        current = false;
      },
      d: function destroy(detaching) {
        if (detaching) detach_dev(main);
        destroy_component(router);
      },
    };

    dispatch_dev("SvelteRegisterBlock", {
      block,
      id: create_fragment.name,
      type: "component",
      source: "",
      ctx,
    });

    return block;
  }

  function instance($$self, $$props, $$invalidate) {
    let { $$slots: slots = {}, $$scope } = $$props;
    validate_slots("App", slots, []);
    let { name } = $$props;
    const writable_props = ["name"];

    Object.keys($$props).forEach((key) => {
      if (
        !~writable_props.indexOf(key) &&
        key.slice(0, 2) !== "$$" &&
        key !== "slot"
      )
        console.warn(`<App> was created with unknown prop '${key}'`);
    });

    $$self.$$set = ($$props) => {
      if ("name" in $$props) $$invalidate(0, (name = $$props.name));
    };

    $$self.$capture_state = () => ({
      Router: Router$1,
      Link: Link$1,
      Route: Route$1,
      paths,
      Home,
      SignIn,
      Onboarding,
      Register,
      name,
    });

    $$self.$inject_state = ($$props) => {
      if ("name" in $$props) $$invalidate(0, (name = $$props.name));
    };

    if ($$props && "$$inject" in $$props) {
      $$self.$inject_state($$props.$$inject);
    }

    return [name];
  }

  class App extends SvelteComponentDev {
    constructor(options) {
      super(options);
      init(this, options, instance, create_fragment, safe_not_equal, {
        name: 0,
      });

      dispatch_dev("SvelteRegisterComponent", {
        component: this,
        tagName: "App",
        options,
        id: create_fragment.name,
      });

      const { ctx } = this.$$;
      const props = options.props || {};

      if (/*name*/ ctx[0] === undefined && !("name" in props)) {
        console.warn("<App> was created without expected prop 'name'");
      }
    }

    get name() {
      throw new Error(
        "<App>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'"
      );
    }

    set name(value) {
      throw new Error(
        "<App>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'"
      );
    }
  }

  const app = new App({
    target: document.body,
    props: {
      name: "world",
    },
  });

  return app;
})();
//# sourceMappingURL=bundle.js.map
