export default {
  info(message, ...args) {
    console.log(message, ...args);
  },
  error(message, ...args) {
    console.error(message, ...args);
  }
};
