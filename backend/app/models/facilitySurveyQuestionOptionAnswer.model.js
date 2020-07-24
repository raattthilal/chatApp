module.exports = function FacilitySurveyQuestionOptionAnswer(sequelize) {
  var Sequelize = sequelize.constructor;
 
  var QuestOption = require('./facilitySurveyQuestionOption.model')(sequelize);
 
  var ret =
    sequelize.define('facilitySurveyQuestionOptionAnswer', {
      facility_survey_id: {
        type: Sequelize.INTEGER
      },
      facility_survey_question_id: {
        type: Sequelize.INTEGER
      },
      facility_survey_question_option_id: {
        type: Sequelize.INTEGER
      },
      facility_survey_question_option_answer: {
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
      tableName: 'facility_survey_question_option_answer',
      timestamps: false

    });
 
 // ret.belongsTo(QuestOption, { foreignKey: 'technology_id', as : 'technologys'});
 


  return ret;
}
