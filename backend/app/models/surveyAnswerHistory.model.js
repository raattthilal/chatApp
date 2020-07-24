module.exports = function SurveyAnswerHistory(sequelize) {
    var Sequelize = sequelize.constructor;
    var question = require('./question.model') (sequelize);
    var questionOption = require('./questionOption.model') (sequelize);

    var ret =
      sequelize.define('surveyAnswerHistory', {
        survey_id: {
          type: Sequelize.INTEGER
        },
        survey_history_id : {
          type: Sequelize.INTEGER
        },
        question_id	: {
          type: Sequelize.INTEGER
        },
        question_option_id	: {
          type: Sequelize.INTEGER
        },
        answer: {
          type: Sequelize.STRING
        },
        point: {
          type: Sequelize.FLOAT
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
        tableName: 'survey_answer_history',
        timestamps: false
  
      });

      ret.belongsTo(questionOption, { foreignKey: 'question_option_id',sourceKey:'id' });
      ret.belongsTo(question, {foreignKey: 'question_id',sourceKey:'id'});
    return ret;
  }
  