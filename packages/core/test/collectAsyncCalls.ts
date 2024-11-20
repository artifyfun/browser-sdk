import { getCurrentJasmineSpec } from './getCurrentJasmineSpec'

export function collectAsyncCalls<F extends jasmine.Func>(
  spy: jasmine.Spy<F>,
  expectedCallsCount: number,
  callback: (calls: jasmine.Calls<F>) => void
) {
  const currentSpec = getCurrentJasmineSpec()
  if (!currentSpec) {
    throw new Error('collectAsyncCalls should be called within jasmine code')
  }

  if (spy.calls.count() === expectedCallsCount) {
    spy.and.callFake(extraCallDetected as F)
    callback(spy.calls)
  } else if (spy.calls.count() > expectedCallsCount) {
    extraCallDetected()
  } else {
    spy.and.callFake((() => {
      if (spy.calls.count() === expectedCallsCount) {
        spy.and.callFake(extraCallDetected as F)
        callback(spy.calls)
      }
    }) as F)
  }

  function extraCallDetected() {
    fail(`Unexpected extra call for spec '${currentSpec!.fullName}'`)
  }
}
export function asyncCollectAsyncCalls<F extends jasmine.Func>(
  spy: jasmine.Spy<F>,
  expectedCallsCount: number
): Promise<jasmine.Calls<F>> {
  return new Promise((resolve, reject) => {
    const currentSpec = getCurrentJasmineSpec()
    if (!currentSpec) {
      reject(new Error('collectAsyncCalls should be called within jasmine code'))
      return
    }

    const checkCalls = () => {
      if (spy.calls.count() === expectedCallsCount) {
        spy.and.callFake(extraCallDetected as F)
        resolve(spy.calls)
      } else if (spy.calls.count() > expectedCallsCount) {
        extraCallDetected()
      }
    }

    checkCalls()

    spy.and.callFake((() => {
      checkCalls()
    }) as F)

    function extraCallDetected() {
      reject(new Error(`Unexpected extra call for spec '${currentSpec!.fullName}'`))
    }
  })
}
