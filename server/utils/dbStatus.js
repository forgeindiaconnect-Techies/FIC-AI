let mongoAvailable = false;

export const setMongoStatus = (status) => {
  mongoAvailable = Boolean(status);
};

export const isMongoAvailable = () => mongoAvailable;
