
module.exports = function questionOperand(sequelize) {
    var Sequelize = sequelize.constructor;

    var ret =
      sequelize.define('questionOperand', {

        question_id: {
          type: Sequelize.INTEGER
        },
        operand_id: {
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
        }
  
      }, {
        tableName: 'question_operand',
        timestamps: false
  
      });
  
    return ret;
  }
  