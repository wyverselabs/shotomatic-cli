import net from "node:net";

export const connectOnce = (socketPath) =>
  new Promise((resolve, reject) => {
    const socket = net.createConnection({ path: socketPath });
    const onError = (error) => {
      socket.destroy();
      reject(error);
    };
    socket.once("error", onError);
    socket.once("connect", () => {
      socket.removeListener("error", onError);
      resolve(socket);
    });
  });
