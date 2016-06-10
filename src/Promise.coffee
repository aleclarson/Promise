
emptyFunction = require "emptyFunction"
spliceArray = require "spliceArray"
assertType = require "assertType"
bindMethod = require "bindMethod"
immediate = require "immediate"
Tracer = require "Tracer"
isType = require "isType"
assert = require "assert"
sync = require "sync"
Type = require "Type"
Any = require "Any"
has = require "has"

QueueItem = require "./QueueItem"

type = Type "Promise"

type.argumentTypes =
  value: Any
  isPending: Boolean.Maybe

type.returnExisting (value) ->
  return value if isType value, Promise

type.defineValues

  _state: 0

  _unhandled: yes

  _results: -> [ undefined ]

  _queue: -> []

  _trace: -> null if isDev

type.definePrototype

  isFulfilled: get: ->
    @_state > 0

  isRejected: get: ->
    @_state < 0

  isPending: get: ->
    @_state is 0

type.initInstance (value, isPending) ->

  if not isPending
    @_tryFulfilling value

type.defineMethods

  then: (onFulfilled, onRejected) ->

    assertType onFulfilled, Function.Maybe
    assertType onRejected, Function.Maybe

    if not @_canResolve onFulfilled, onRejected
      return this

    promise = Promise._defer()
    @_then promise, onFulfilled, onRejected
    return promise

  fail: (onRejected) ->
    assertType onRejected, Function.Maybe
    promise = Promise._defer()
    @_then promise, undefined, onRejected
    return promise

  always: (onResolved) ->

    assertType onResolved, Function

    promise = Promise._defer()

    onFulfilled = ->
      spliceArray arguments, 0, 0, null     # Set 'error' to null
      try onResolved.apply null, arguments  # Ignore errors from 'onResolved'
      return arguments[1]                   # Return the 'result'

    onRejected = ->
      spliceArray arguments, 1, 0, null     # Set 'result' to null
      try onResolved.apply null, arguments  # Ignore errors from 'onResolved'
      throw arguments[0]                    # Rethrow the 'error'

    @_then promise, onFulfilled, onRejected
    return promise

  curry: ->
    args = arguments
    return promise = @always ->
      for value in args
        promise._results.push value
      return

  inspect: ->

    state:
      if @_state > 0 then "fulfilled"
      else if @_state < 0 then "rejected"
      else "pending"

    value: @_results[0]

    meta: @_results.slice 1

  # Must never be passed a Promise.
  # Fails gracefully if 'this.isPending' is false.
  _fulfill: (value) ->

    return if not @isPending

    assert not isType(value, Promise), "Cannot fulfill with a Promise as the result!"

    @_state = 1
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

    @_state = -1
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

  # If a promise is passed, calls its 'then' method.
  # Otherwise, fulfill this with 'value'.
  _tryFulfilling: (value) ->

    # Attach this Promise directly to the given Promise.
    if isType value, Promise
      value._then this
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

  # If the promise is fulfilled or rejected,
  # the opposite handler will never be called.
  _canResolve: (onFulfilled, onRejected) ->
    return no if @isFulfilled and not isType onFulfilled, Function
    return no if @isRejected and not isType onRejected, Function
    return yes

  # This is similar to `this.then()`
  # but the Promise must be passed in.
  _then: (promise, onFulfilled, onRejected) ->

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

    assert not @isPending, "This promise must be resolved before notifying the next promise!"

    if isDev
      promise._trace = Tracer "Promise::_thenResolve()"

    immediate =>
      results = @_results
      promise._inheritResults results

      if resolver
        promise._resolve results, resolver
        return

      if @isFulfilled
        promise._fulfill results[0]
        return

      promise._reject results[0]
      return

  # Inherits every result (except for the first one).
  _inheritResults: (results) ->
    { length } = results
    return if length <= 1
    index = 1
    while index < length
      @_results.push results[index]
      index += 1
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
    promise: promise = Promise._defer()
    resolve: (result) -> promise._tryFulfilling result
    reject: (error) -> promise._reject error

  resolve: (resolver) ->
    assertType resolver, Function
    promise = Promise._defer()
    promise._tryResolving resolver
    return promise

  reject: (error) ->
    assertType error, Error.Kind
    promise = Promise._defer()
    promise._reject error
    return promise

  try: (func) ->
    assertType func, Function
    promise = Promise._defer()
    promise._trace = Tracer "Promise.try()" if isDev
    immediate => promise._resolve [], func
    return promise

  wrap: (func) ->
    assertType func, Function
    return ->
      self = this
      args = arguments
      Promise.try ->
        func.apply self, args

  ify: (func) ->
    assertType func, Function
    push = Array::push
    return ->
      deferred = Promise._defer()
      push.call arguments, (error, result) ->
        if error then deferred._reject error
        else deferred._fulfill result
      func.apply this, arguments
      return deferred

  all: (array) ->

    assertType array, Array

    { length } = array
    if not length
      return Promise []

    results = new Array length
    remaining = length

    deferred = Promise._defer()

    reject = bindMethod deferred, "_reject"
    fulfill = (result, index) ->
      assert not has(results, index), "Cannot fulfill more than once!"
      results[index] = result
      unless --remaining
        deferred._fulfill results

    index = -1
    while ++index < length
      Promise array[index]
        .curry index
        .then fulfill, reject

    return deferred

  map: (iterable, iterator) ->
    assertType iterator, Function
    Promise.all sync.reduce iterable, [], (promises, value, key) ->
      promises.push Promise.try -> iterator.call null, value, key
      return promises

  chain: (iterable, iterator) ->
    assertType iterator, Function
    sync.reduce iterable, Promise(), (chain, value, key) ->
      chain.then -> iterator.call null, value, key

  # Create a pending Promise.
  _defer: -> Promise undefined, yes

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
