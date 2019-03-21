describe('basic test', () => {
  // Read more about fake timers: http://facebook.github.io/jest/docs/en/timer-mocks.html#content
  jest.useFakeTimers();

  // Act before assertions
  beforeAll(async () => {
    jest.runOnlyPendingTimers();

    // tslint:disable-next-line:mocha-unneeded-done
    it('expect true to be true', (done: any) => {
      expect(true).toBeTruthy();
      
      done();
    });
  });

});
