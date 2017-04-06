
"use strict";

module.exports = function(sequelize, DataTypes) {
  var Client = sequelize.define("client", {
    firstname: DataTypes.STRING,
    lastname: DataTypes.STRING,
    email: DataTypes.STRING,
    source: DataTypes.STRING,
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE
  });

  return Client;
};
