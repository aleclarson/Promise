
require "isDev"

emptyFunction = require "emptyFunction"
spliceArray = require "spliceArray"
PureObject = require "PureObject"
assertType = require "assertType"
bindMethod = require "bindMethod"
wrapValue = require "wrapValue"
immediate = require "immediate"
hasKeys = require "hasKeys"
Tracer = require "tracer"
isType = require "isType"
assert = require "assert"
sync = require "sync"
Type = require "Type"

QueueItem = require "./QueueItem"

PENDING = Symbol "Promise.PENDING"
FULFILLED = Symbol "Promise.FULFILLED"
REJECTED = Symbol "Promise.REJECTED"

type = Type "Promise"

type.returnExisting (value) ->
  if isType value, Promise
    value._inheritResults arguments
    return value

type.defineValues

  _state: PENDING

  _unhandled: yes

  _results: -> [ undefined ]

  _queue: -> []

  _tracers: -> {} if isDev

type.initInstance (value) ->
  @_inheritResults arguments
  @_tryFulfilling value if value isnt PENDING

type.definePrototype

  state: get: ->
    if @isFulfilled then "fulfilled"
    else if @isRejected then "rejected"
    else "pending"

  value: get: ->
    @_results[0]

  error: get: ->
    @_results[0]

  meta: get: ->
    @_results.slice 1

  isPending: get: ->
    @_state is PENDING

  isFulfilled: get: ->
    @_state is FULFILLED

  isRejected: get: ->
    @_state is REJECTED

type.defineMethods

  inspect: -> { @state, @value, @meta }

  then: (onFulfilled, onRejected) ->

    assertType onFulfilled, Function.Maybe
    assertType onRejected, Function.Maybe

    if not @_canResolve onFulfilled, onRejected
      return this

    promise = Promise._defer()
    isDev and promise._tracers.init = Tracer "promise.then()"

    @_then promise, onFulfilled, onRejected
    return promise

  fail: (onRejected) ->

    assertType onRejected, Function.Maybe

    promise = Promise._defer()
    isDev and promise._tracers.init = Tracer "promise.fail()"

    @_then promise, undefined, onRejected
    return promise

  always: (onResolved) ->

    assertType onResolved, Function

    promise = Promise._defer()

    isDev and promise._tracers.init = Tracer "promise.always()"

    @_always promise, onResolved

    return promise

  curry: ->

    @_unhandled = no

    if @isPending
      results = arguments
      promise = @always =>
        promise._inheritResults @_results
        promise._results.push result for result in results
        return

    else
      promise = Promise._defer()
      promise._inheritResults @_results
      promise._results.push arg for arg in arguments
      if @isFulfilled then promise._fulfill @value
      else promise._reject @error

    isDev and promise._tracers.init = Tracer "promise.curry()"
    return promise

  # The only difference from 'this.then'
  # is that a Promise must be passed.
  _then: (promise, onFulfilled, onRejected) ->

    assertType promise, Promise
    assertType onFulfilled, Function.Maybe
    assertType onRejected, Function.Maybe

    @_unhandled = no

    if @isPending
      @_queue.push QueueItem promise, onFulfilled, onRejected
      return

    if @isFulfilled
      @_thenResolve promise, onFulfilled
      return

    @_thenResolve promise, onRejected
    return

  # The only difference from 'this.always'
  # is that a Promise must be passed.
  _always: (promise) ->

    assertType promise, Promise
    assertType arguments[1], Function.Maybe

    if arguments[1]

      onResolved = wrapValue arguments[1], (onResolved) => (args) =>

        result = onResolved.apply null, args

        # Ignore return value of `onResolved`; unless it's a Promise.
        return FULFILLED if not isType result, Promise

        # Ignore return value of inner promise.
        return FULFILLED if result.isFulfilled

        # But use any error of inner promise.
        throw result.error if result.isRejected

        # Create new Promise that resolves when
        # the inner promise does, but override
        # the results to match the parent promise.
        # If the inner promise throws an error,
        # it is used to reject the outer promise.
        deferred = Promise._defer()
        result._queue.push QueueItem deferred, =>
          deferred._inheritResults @_results
          return @value if @isFulfilled
          throw @error

        return deferred

    onFulfilled = =>

      if onResolved
        spliceArray arguments, 0, 0, null
        result = onResolved arguments
        return result if result isnt FULFILLED

      promise._inheritResults @_results
      return @value

    onRejected = =>

      if onResolved
        spliceArray arguments, 1, 0, null
        result = onResolved arguments
        return result if result isnt FULFILLED

      promise._inheritResults @_results
      throw @error

    @_then promise, onFulfilled, onRejected
    return

  # Must never be passed a Promise.
  # Fails gracefully if 'this.isPending' is false.
  _fulfill: (value) ->

    return if not @isPending

    assert not isType(value, Promise), "Cannot fulfill with a Promise as the result!"

    @_state = FULFILLED
    @_results[0] = value

    if @_queue.length
      for item in @_queue
        item.fulfill this

    @_queue = null
    return

  # Must be passed an instanceof Error.
  # Fails gracefully if 'this.isPending' is false.
  _reject: (error) ->

    return if not @isPending

    assertType error, Error.Kind

    @_state = REJECTED
    @_results[0] = error

    if @_unhandled then immediate =>
      return if not @_unhandled
      Promise._onUnhandledRejection error, this

    if @_queue.length
      for item in @_queue
        item.reject this

    @_queue = null
    return

  # Wait until the given 'resolver' has a result that isn't a pending Promise.
  # The given 'results' are applied to the 'resolver'.
  _resolve: (results, resolver) ->

    assertType results, Array
    assertType resolver, Function

    try
      result = resolver.apply null, results
      assert result isnt this, "Cannot resolve a Promise with itself!"

    catch error
      @_reject error
      return

    @_tryFulfilling result
    return

  # Fulfill this Promise with any value.
  # If a Promise is passed, use it to resolve this Promise.
  _tryFulfilling: (value) ->

    # Resolve with the results of the given Promise.
    if isType value, Promise
      value._always this
      return

    # Check for a thenable value.
    result = tryCatch getResolver, value

    if result.error
      @_reject result.error
      return

    # If 'value' has a 'then' method, it is
    # passed into 'this._tryResolving'!
    resolver = result.value
    if resolver
      @_tryResolving resolver
      return

    @_fulfill value
    return

  # Passes 'resolve' and 'reject' to the given 'resolver'.
  # Any errors thrown by 'resolver' are passed to 'reject'.
  # Must call 'resolve' to fulfill this promise.
  _tryResolving: (resolver) ->

    assertType resolver, Function

    reject = bindMethod this, "_reject"
    resolve = bindMethod this, "_tryFulfilling"

    { error } = tryCatch ->
      resolver resolve, reject

    reject error if error
    return

  # Inherits every result (except for the first one).
  _inheritResults: (results) ->

    assertType results, [ Array, Object ]

    { length } = results
    return if length <= 1

    index = 0 # Skip the first result.
    @_results.push results[index] while ++index < length
    return

  # If the promise is fulfilled or rejected,
  # the opposite handler will never be called.
  _canResolve: (onFulfilled, onRejected) ->
    return no if @isFulfilled and not isType onFulfilled, Function
    return no if @isRejected and not isType onRejected, Function
    return yes

  # Use this Promise to resolve the given Promise.
  # The 'resolver' is an optional Function.
  _thenResolve: (promise, resolver) ->

    assertType promise, Promise
    assertType resolver, Function.Maybe

    assert not @isPending, "Cannot use a pending Promise to resolve another Promise!"
    assert promise.isPending, "Cannot resolve a Promise that is not pending!"

    if resolver
      isDev and promise._tracers.resolve = Tracer "Promise::_thenResolve()"
      immediate => promise._resolve @_results, resolver
      return

    if @isFulfilled
      promise._fulfill @value
      return

    promise._reject @error
    return

type.defineStatics

  isFulfilled: (value) ->
    return no if not isType value, Promise
    return value.isFulfilled

  isRejected: (value) ->
    return yes if not isType value, Promise
    return value.isRejected

  isPending: (value) ->
    return no if not isType value, Promise
    return value.isPending

  defer: ->
    promise = Promise._defer()
    isDev and promise._tracers.init = Tracer "Promise.defer()"
    promise: promise
    resolve: (result) -> promise._tryFulfilling result
    reject: (error) -> promise._reject error

  resolve: (resolver) ->
    assertType resolver, Function
    promise = Promise._defer()
    isDev and promise._tracers.init = Tracer "Promise.resolve()"
    promise._tryResolving resolver
    return promise

  reject: (error) ->
    assertType error, Error.Kind
    promise = Promise._defer()
    isDev and promise._tracers.init = Tracer "Promise.reject()"
    promise._reject error
    return promise

  try: (func) ->
    assertType func, Function
    promise = Promise._defer()
    isDev and promise._tracers.init = Tracer "Promise.try()"
    immediate => promise._resolve [], func
    return promise

  wrap: (func) ->
    assertType func, Function
    return ->
      self = this
      args = arguments
      promise = Promise.try -> func.apply self, args
      isDev and promise._tracers.init = Tracer "Promise.wrap()"
      return promise

  ify: (func) ->
    assertType func, Function
    push = Array::push
    return ->
      promise = Promise._defer()
      isDev and promise._tracers.init = Tracer "Promise.ify()"
      push.call arguments, (error, result) ->
        if error then promise._reject error
        else promise._fulfill result
      func.apply this, arguments # TODO: Wrap this in try/catch?
      return promise

  all: (array) ->

    assertType array, Array

    { length } = array

    if length is 0
      return Promise []

    promise = Promise._defer()
    isDev and promise._tracers.init = Tracer "Promise.all()"

    results = new Array length
    remaining = length

    reject = bindMethod promise, "_reject"
    fulfill = (result, index) ->
      return if not promise.isPending
      assertType index, Number
      results[index] = result
      remaining -= 1
      if remaining is 0
        promise._fulfill results
      return

    sync.repeat length, (index) ->
      deferred = Promise array[index], index
      deferred.then fulfill, reject
      return

    return promise

  map: (iterable, iterator) ->

    assertType iterator, Function

    promise = Promise._defer()
    isDev and promise._tracers.init = Tracer "Promise.map()"

    if Array.isArray iterable
      results = new Array iterable.length

    else if PureObject.test iterable
      results = Object.create null

    else
      results = {}

    if not hasKeys iterable
      promise._fulfill results
      return promise

    reject = bindMethod promise, "_reject"
    fulfill = (result, key) ->
      return if not promise.isPending
      assertType key, [ String, Number ]
      results[key] = result
      remaining -= 1
      if remaining is 0
        promise._fulfill results
      return

    remaining = 0
    sync.each iterable, (value, key) ->
      remaining += 1
      deferred = Promise.try -> iterator.call null, value, key
      deferred._results.push key
      deferred.then fulfill, reject
      return

    return promise

  chain: (iterable, iterator) ->
    assertType iterator, Function
    return sync.reduce iterable, Promise(), (chain, value, key) ->
      chain.then -> iterator.call null, value, key

  # Create a pending Promise.
  _defer: -> Promise PENDING

  # A hook for handling unhandled rejections.
  _onUnhandledRejection: emptyFunction

module.exports = Promise = type.build()

#
# Helpers
#

# The function returned here will be
# passed the 'resolve' and 'reject' functions.
getResolver = (value) ->
  resolver = value and value.then
  return unless resolver instanceof Function
  return -> resolver.apply value, arguments

tryCatch = (func, value) ->
  try { value: func value }
  catch error then return { error }
