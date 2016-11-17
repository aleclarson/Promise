
# Promise v2.1.0 ![experimental](https://img.shields.io/badge/stability-experimental-EC5315.svg?style=flat)

A `Promise` implementation written in CoffeeScript and derived from [calvinmetcalf/lie](https://github.com/calvinmetcalf/lie).

**NOTE:** This is not entirely spec-compliant.

```coffee
# Fulfill a new Promise with the given value.
promise = Promise result

# If an object with a `then` method is passed,
# use it to resolve the new Promise.
promise = Promise thenable

# Attach metadata to the new Promise.
# For example, attach the `index` and `array`
# when the Promise is created inside a loop.
promise = Promise result, index, array

# Reject a new Promise with the given error.
promise = Promise.reject error
```

&nbsp;

### Promise.try

```coffee
promise = Promise.try func
```

Call a `Function` safely and resolve its result into a `Promise`.

It's guaranteed that `func` won't be called until the next event loop tick.

If `func` throws, the `Promise` will be rejected.

If this function returns a Promise, we will wait
for the Promise to be resolved, and then resolve the
Promise created by 'Promise.try'.

&nbsp;

### Promise::then

```coffee
promise.then onFulfilled, onRejected
```

Wait until this `Promise` is resolve, then call `onFulfilled` if
this `Promise` is fulfilled, or call `onRejected` if this `Promise` is rejected.

Both `onFulfilled` and `onRejected` can be undefined, without an error being thrown.

Only one of the passed functions will ever be called. If this `Promise` is never
resolved, none of the passed functions will ever be called.

&nbsp;

### Promise::fail

```coffee
promise.fail onRejected
```

Wait until `promise` is rejected, then call `onRejected` with an `Error`.

&nbsp;

### Promise::always

```coffee
promise.always onResolved
```

Wait until this `Promise` is resolved, then call the given `Function`.

**NOTE:** The `onResolved` function is never passed any arguments!

&nbsp;

### Promise::notify

```coffee
promise.notify callback
```

Once `promise` is resolved, an `(error, result)` tuple is passed to the given `callback`.

If the `callback` throws an error, the returned `Promise` is rejected with the error.

Otherwise, the returned `Promise` will always mock its parent `Promise`.

&nbsp;

### Promise.defer

Create a pending `Promise` that is resolved manually.

```coffee
deferred = Promise.defer()

# The new Promise you should return.
deferred.promise

# Try resolving the new Promise.
# If the result is "thenable", depend on it.
deferred.resolve result

# Reject the new Promise.
deferred.reject error
```

Alternatively, you can pass in a `Function`.

```coffee
promise = Promise.defer resolver
```

The `resolver` function is passed `(resolve, reject)` and should call one or the other.

&nbsp;

### Promise.all

```coffee
promise = Promise.all values
```

Wrap all values in an `Array` with `Promise()`.

The returned `Promise` is:
- fulfilled when **all** of its promises are fulfilled.
- rejected when **any** of its promises are rejected.

&nbsp;

### Promise.map

```coffee
promise = Promise.map iterable, iterator
```

Iterate over an `Array` or `Object`, wrapping each item with `Promise.try()`.

Iteration over `Object.create(null)` is also supported!

The returned `Promise` is:
- fulfilled when **all** of its promises are fulfilled.
- rejected when **any** of its promises are rejected.

&nbsp;

### Promise.chain

```coffee
promise = Promise.chain iterable, iterator
```

Works exactly like `Promise.map`, except each iteration must be
resolved before the next iteration takes place.

&nbsp;

### Promise.wrap

Wrap a `Function` with a call to `Promise.try`.

This means the `Function` can throw an `Error` to reject the returned `Promise`.

The value returned by your `Function` will attempt to be resolved into a fulfilled `Promise`.

```coffee
obj = {}
obj.foo = 1
obj.method = Promise.wrap (bar) -> @foo + bar

promise = obj.method 2
promise.then (result) ->
  console.log result # => 3
```

&nbsp;

### Promise.ify

Takes a `Function` that expects an `(error, result)` callback.

Returns a `Function` that always returns a `Promise`.

```coffee
#
# Before
#

orig = (callback) ->
  callback error, result

orig (error, result) ->
  # ...

#
# After
#

func = Promise.ify orig

promise = func()
```

&nbsp;

### Checking the state of a Promise

```coffee
# Equals true if the Promise is neither fulfilled or rejected.
promise.isPending

# Equals true if the Promise was resolved without error.
promise.isFulfilled

# Equals true if the Promise caught an error.
promise.isRejected

# Returns true when the given value is a pending Promise.
Promise.isPending value

# Returns true when the given value is a fulfilled Promise.
Promise.isFulfilled value

# Returns true when the given value is a rejected Promise.
# If the given value is not a `Promise`, the returned value is `true`.
Promise.isRejected value
```

&nbsp;

### Unhandled rejections

The `Promise` class allows multiple callbacks to listen for unhandled rejections.

```coffee
Promise.onUnhandledRejection (error, promise) ->
  # TODO: Handle the rejected promise!
```

&nbsp;
