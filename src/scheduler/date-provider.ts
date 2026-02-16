export interface DateTimeProvider {
  now(): Date;
}

export class SystemDateTimeProvider implements DateTimeProvider {
  now(): Date {
    return new Date();
  }
}

export class MockDateTimeProvider implements DateTimeProvider {
  private currentTime: Date;

  constructor(initialTime: Date) {
    this.currentTime = initialTime;
  }

  now(): Date {
    return this.currentTime;
  }

  setTime(time: Date): void {
    this.currentTime = time;
  }
}
