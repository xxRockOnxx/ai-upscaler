class QueueError extends Error {
  constructor(message) {
    super(message);
    this.name = 'QueueError';
  }
}

module.exports = {
  QueueError,
};
