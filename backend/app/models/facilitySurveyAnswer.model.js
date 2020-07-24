module.exports = function FacilitySurveyAnswer(sequelize) {
  var Sequelize = sequelize.constructor;
  
  var FacilitySurveyQuestion = require('./facilitySurveyQuestion.model')(sequelize);
  var FacilitySurveyQuestionOption = require('./facilitySurveyQuestionOption.model')(sequelize);
 
  var ret =
    sequelize.define('facilitySurveyAnswer', {
      facility_survey_id: {
        type: Sequelize.INTEGER
      },
      facility_survey_question_id: {
        type: Sequelize.INTEGER
      },
      facility_survey_question_option_id: {
        type: Sequelize.INTEGER
      },
      answer_text: {
        type: Sequelize.STRING
      },
      answer_date: {
        type: 'TIMESTAMP'
      },
      answer_digit: {
        type: Sequelize.INTEGER
      },
      answer_decimal: {
        type: Sequelize.DOUBLE
      },
      is_checkbox: {
        type: Sequelize.INTEGER
      },
      is_dropdown: {
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
      tableName: 'facility_survey_answer',
      timestamps: false

    });
 
   ret.belongsTo(FacilitySurveyQuestion, { foreignKey: 'facility_survey_question_id' });
   ret.belongsTo(FacilitySurveyQuestionOption, { foreignKey: 'facility_survey_question_option_id'});
  

  return ret;
}
