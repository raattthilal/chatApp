
module.exports = function questionGroup(sequelize) {
    var Sequelize = sequelize.constructor;

    var ret =
      sequelize.define('questionGroup', {

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
        tableName: 'question_group',
        timestamps: false
  
      });
  
    return ret;
  }
  