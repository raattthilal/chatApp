module.exports = function Meta(sequelize) {
    var Sequelize = sequelize.constructor;
    var ret =
      sequelize.define('meta', {
        key: {
          type: Sequelize.STRING
        },
        value: {
          type: Sequelize.STRING
        },
        flag: {
          type: Sequelize.INTEGER
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
        tableName: 'meta_info',
        timestamps: false
  
      });
  
    return ret;
  }
  