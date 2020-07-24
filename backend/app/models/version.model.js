module.exports = function Version(sequelize) {
  var Sequelize = sequelize.constructor;
  var ret =
    sequelize.define('version', {
     version	: {
        type: Sequelize.DOUBLE
      },
      status: {
          type: Sequelize.INTEGER
      },
      created_at: {
        type: 'TIMESTAMP',
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        allowNull: false
      },
      modified_at: {
        type: 'TIMESTAMP',
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        allowNull: false
      },

    }, {
      tableName: 'version',
      timestamps: false

    });
  return ret;
}
