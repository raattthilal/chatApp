module.exports = function QuestionOption(sequelize) {
    var Sequelize = sequelize.constructor;

    var ret =
      sequelize.define('questionOption', {
        name_en: {
          type: Sequelize.STRING
        },
        name_ml: {
          type: Sequelize.STRING
        },
        question_id: {
          type: Sequelize.INTEGER
        },
        // field_name: {
        //   type: Sequelize.STRING
        // },
        points: {
          type: Sequelize.INTEGER
        },
        child_question_id: {
          type: Sequelize.INTEGER
        },
        question_group_id: {
          type: Sequelize.INTEGER
        },
        sort_order: {
          type: Sequelize.INTEGER
        },
        value: {
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
        },
  
      }, {
        tableName: 'question_option',
        timestamps: false
  
      });
  
    return ret;
  }
  