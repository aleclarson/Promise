
require "isDev"

emptyFunction = require "emptyFunction"
spliceArray = require "spliceArray"
PureObject = require "PureObject"
assertType = require "assertType"
bindMethod = require "bindMethod"
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

type.defineValues

  _state: PENDING

  _unhandled: yes

  _values: -> [ undefined ]

  _queue: -> []

  _tracers: -> {} if isDev

type.initInstance (result) ->
  @_inheritValues arguments, 1
  @_tryFulfilling result if result isnt PENDING

type.definePrototype

  state: get: ->
    if @isFulfilled then "fulfilled"
    else if @isRejected then "rejected"
    else "pending"

  isPending: get: ->
    @_state is PENDING

  isFulfilled: get: ->
    @_state is FULFILLED

  isRejected: get: ->
    @_state is REJECTED

type.defineMethods

  inspect: ->
    data = { @state }
    if @isFulfilled
      data.value = @_values[0]
    else if @isRejected
      data.error = @_values[0]
    if @_values.length > 1
      data.meta = @_values.slice 1
    return data

  then: (onFulfilled, onRejected) ->

    assertType onFulfilled, Function.Maybe
    assertType onRejected, Function.Maybe

    if not @_canResolve onFulfilled, onRejected
      return this

    promise = Promise PENDING
    isDev and promise._tracers.init = Tracer "promise.then()"

    @_then promise, onFulfilled, onRejected
    return promise

  fail: (onRejected) ->

    assertType onRejected, Function.Maybe

    promise = Promise PENDING
    isDev and promise._tracers.init = Tracer "promise.fail()"

    @_then promise, undefined, onRejected
    return promise

  always: (onResolved) ->

    assertType onResolved, Function

    promise = Promise PENDING

    isDev and promise._tracers.init = Tracer "promise.always()"

    @_always promise, onResolved

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

  # Use this Promise to resolve the given Promise.
  # The 'resolver' is an optional Function.
  _thenResolve: (promise, resolver) ->

    assertType promise, Promise
    assertType resolver, Function.Maybe

    assert not @isPending, "Cannot use a pending Promise to resolve another Promise!"
    assert promise.isPending, "Cannot resolve a Promise that is not pending!"

    if resolver
      isDev and promise._tracers.resolve = Tracer "Promise::_thenResolve()"
      immediate => promise._resolve @_values, resolver
      return

    if @isFulfilled
      promise._fulfill @_values[0]
      return

    promise._reject @_values[0]
    return

  # The only difference from 'this.always'
  # is that a Promise must be passed.
  _always: (promise, onResolved) ->

    assertType promise, Promise
    assertType arguments[1], Function.Maybe

    onResolved and resolve = (args) =>

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
      deferred = Promise PENDING
      result._queue.push QueueItem deferred, =>
        deferred._inheritValues @_values, 1
        return @_values[0] if @isFulfilled
        throw @_values[0]

      return deferred

    onFulfilled = =>

      if onResolved
        spliceArray arguments, 0, 0, null
        result = resolve arguments
        return result if result isnt FULFILLED

      promise._inheritValues @_values, 1
      return @_values[0]

    onRejected = =>

      if onResolved
        spliceArray arguments, 1, 0, null
        result = resolve arguments
        return result if result isnt FULFILLED

      promise._inheritValues @_values, 1
      throw @_values[0]

    @_then promise, onFulfilled, onRejected
    return

  _inheritValues: (values, startIndex) ->

    assertType values, [ Array, Object ]

    { length } = values
    return if startIndex >= length

    index = startIndex - 1
    @_values.push values[index] while ++index < length
    return

  # If the promise is fulfilled or rejected,
  # the opposite handler will never be called.
  _canResolve: (onFulfilled, onRejected) ->
    return no if @isFulfilled and not isType onFulfilled, Function
    return no if @isRejected and not isType onRejected, Function
    return yes

  # Must never be passed a Promise.
  # Fails gracefully if 'this.isPending' is false.
  _fulfill: (value) ->

    return if not @isPending

    assert not isType(value, Promise), "Cannot fulfill with a Promise as the result!"

    @_state = FULFILLED
    @_values[0] = value

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
    @_values[0] = error

    if @_unhandled then immediate =>
      return if not @_unhandled
      Promise._onUnhandledRejection error, this

    if @_queue.length
      for item in @_queue
        item.reject this

    @_queue = null
    return

  # Wait until the given 'resolver' has a result that isn't a pending Promise.
  # The given 'args' are applied to the 'resolver'.
  _resolve: (args, resolver) ->

    assertType args, Array if args?
    assertType resolver, Function

    try
      result = resolver.apply null, args
      assert result isnt this, "Cannot resolve a Promise with itself!"

    catch error
      @_reject error
      return

    @_tryFulfilling result
    return

  # Fulfill this Promise with any value.
  # If a Promise is passed, use it to resolve this Promise.
  _tryFulfilling: (result) ->

    if isType result, Promise
      result._always this
      return

    resolver = result and result.then
    if typeof resolver is "function"
      @_tryResolving -> resolver.apply result, arguments
      return

    @_fulfill result
    return

  # Passes 'resolve' and 'reject' to the given 'resolver'.
  # Any errors thrown by 'resolver' are passed to 'reject'.
  # Must call 'resolve' to fulfill this promise.
  _tryResolving: (resolver) ->

    assertType resolver, Function

    reject = bindMethod this, "_reject"
    resolve = bindMethod this, "_tryFulfilling"

    try resolver resolve, reject
    catch error then reject error
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
    promise = Promise PENDING
    isDev and promise._tracers.init = Tracer "Promise.defer()"
    promise: promise
    resolve: (result) -> promise._tryFulfilling result
    reject: (error) -> promise._reject error

  resolve: (resolver) ->
    assertType resolver, Function
    promise = Promise PENDING
    isDev and promise._tracers.init = Tracer "Promise.resolve()"
    promise._tryResolving resolver
    return promise

  reject: (error) ->
    assertType error, Error.Kind
    promise = Promise PENDING
    isDev and promise._tracers.init = Tracer "Promise.reject()"
    promise._reject error
    return promise

  try: (func) ->
    assertType func, Function
    promise = Promise PENDING
    isDev and promise._tracers.init = Tracer "Promise.try()"
    immediate -> promise._resolve null, func
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
      promise = Promise PENDING
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

    promise = Promise PENDING
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
      Promise array[index], index
        .then fulfill, reject

    return promise

  map: (iterable, iterator) ->

    assertType iterator, Function

    promise = Promise PENDING
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
    sync.each iterable, (result, key) ->
      remaining += 1
      deferred = Promise.try -> iterator.call null, result, key
      deferred._values.push key
      deferred.then fulfill, reject
      return

    return promise

  chain: (iterable, iterator) ->
    assertType iterator, Function
    return sync.reduce iterable, Promise(), (chain, value, key) ->
      chain.then -> iterator.call null, value, key

  # A hook for handling unhandled rejections.
  _onUnhandledRejection: emptyFunction

module.exports = Promise = type.build()
