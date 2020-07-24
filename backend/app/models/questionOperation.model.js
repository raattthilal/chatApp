
module.exports = function questionOperation(sequelize) {
    var Sequelize = sequelize.constructor;

    var ret =
      sequelize.define('questionOperation', {

        type: {
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
        tableName: 'question_operation',
        timestamps: false
  
      });
  
    return ret;
  }
  