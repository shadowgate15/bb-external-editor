import { Semaphore as Semaphore_ } from 'async-mutex'

export class Semaphore extends Semaphore_ {
  private maxValue: number

  constructor(startingValue: number) {
    super(startingValue)

    this.maxValue = startingValue
  }

  getMaxValue() {
    return this.maxValue
  }

  /**
   * Sets the max value to the given value,
   * and also updates the current value by the same amount so that the semaphore is still at full capacity after the change
   *
   * returns the difference between the new max value and the old max value, which can be used to adjust the current value accordingly
   */
  setMaxValue(value: number) {
    const diffference = value - this.maxValue

    this.setValue(this.getValue() + diffference)

    this.maxValue = value

    return diffference
  }

  /**
   * Adds the given value to the max value,
   * and also adds it to the current value so that the semaphore is still at full capacity after the increase
   */
  addToMaxValue(value: number) {
    this.maxValue += value

    this.setValue(this.getValue() + value)
  }
}
