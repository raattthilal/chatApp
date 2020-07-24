module.exports = function idGenerator(sequelize) {
    var Sequelize = sequelize.constructor;

    var ret =
      sequelize.define('idGenerator', {

        name: {
          type: Sequelize.STRING
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
        }
  
      }, {
        tableName: 'id_generator',
        timestamps: false
  
      });
  
    return ret;
  }
  